package queuelab

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/segmentio/kafka-go"
)

type Handler struct {
	db                     *pgxpool.Pool
	jwtSecret              string
	kafkaBrokers           []string
	rabbitMQURL            string
	rabbitMQManagementURL  string
	rabbitMQManagementUser string
	rabbitMQManagementPass string
}

func NewHandler(db *pgxpool.Pool, jwtSecret string, kafkaBrokers string, rabbitMQURL string, rabbitMQManagementURL string, rabbitMQManagementUser string, rabbitMQManagementPass string) *Handler {
	return &Handler{
		db:                     db,
		jwtSecret:              jwtSecret,
		kafkaBrokers:           splitCSV(kafkaBrokers),
		rabbitMQURL:            strings.TrimSpace(rabbitMQURL),
		rabbitMQManagementURL:  strings.TrimRight(strings.TrimSpace(rabbitMQManagementURL), "/"),
		rabbitMQManagementUser: strings.TrimSpace(rabbitMQManagementUser),
		rabbitMQManagementPass: rabbitMQManagementPass,
	}
}

func (h *Handler) Register(g *echo.Group) {
	group := g.Group("/queue-lab", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("/kafka/concepts", h.KafkaConcepts)
	group.GET("/kafka/topics", h.ListKafkaTopics)
	group.POST("/kafka/topics", h.CreateKafkaTopic)
	group.POST("/kafka/messages", h.SendKafkaMessage)
	group.POST("/kafka/consume", h.ConsumeKafkaMessages)
	group.GET("/rabbitmq/concepts", h.RabbitMQConcepts)
	group.GET("/rabbitmq/queues", h.ListRabbitMQQueues)
	group.GET("/rabbitmq/exchanges", h.ListRabbitMQExchanges)
	group.POST("/rabbitmq/queues", h.DeclareRabbitMQQueue)
	group.POST("/rabbitmq/messages", h.SendRabbitMQMessage)
	group.POST("/rabbitmq/consume", h.ConsumeRabbitMQMessage)
	group.GET("/iot/:protocol/concepts", h.IoTProtocolConcepts)
	group.POST("/iot/:protocol/messages", h.SendIoTProtocolMessage)
}

type StepLog struct {
	Step   int    `json:"step"`
	Status string `json:"status"`
	Detail string `json:"detail"`
	At     string `json:"at"`
}

type ConceptData struct {
	Shared      []string `json:"shared"`
	Differences []string `json:"differences"`
}

type OperationResponse struct {
	Logs     []StepLog   `json:"logs"`
	Result   any         `json:"result"`
	Concepts ConceptData `json:"concepts"`
}

type KafkaTopicRequest struct {
	Topic      string `json:"topic"`
	Partitions int    `json:"partitions"`
}

type KafkaMessageRequest struct {
	Topic string `json:"topic"`
	Key   string `json:"key"`
	Value string `json:"value"`
}

type KafkaConsumeRequest struct {
	Topic  string `json:"topic"`
	Offset string `json:"offset"`
	Limit  int    `json:"limit"`
}

type KafkaMessageRow struct {
	Topic     string `json:"topic"`
	Partition int    `json:"partition"`
	Offset    int64  `json:"offset"`
	Key       string `json:"key"`
	Value     string `json:"value"`
	Time      string `json:"time"`
}

type KafkaTopicRow struct {
	Topic        string `json:"topic"`
	Partitions   int    `json:"partitions"`
	FirstOffset  int64  `json:"first_offset"`
	LastOffset   int64  `json:"last_offset"`
	MessageCount int64  `json:"message_count"`
	Leader       string `json:"leader"`
	Internal     bool   `json:"internal"`
}

type RabbitMQQueueRequest struct {
	Queue string `json:"queue"`
}

type RabbitMQMessageRequest struct {
	Queue string `json:"queue"`
	Value string `json:"value"`
}

type RabbitMQConsumeRequest struct {
	Queue string `json:"queue"`
	Ack   bool   `json:"ack"`
}

type RabbitMQMessageRow struct {
	Queue       string `json:"queue"`
	DeliveryTag uint64 `json:"delivery_tag"`
	Value       string `json:"value"`
	Redelivered bool   `json:"redelivered"`
	Time        string `json:"time"`
}

type RabbitMQQueueRow struct {
	Name      string `json:"name"`
	Vhost     string `json:"vhost"`
	Messages  int64  `json:"messages"`
	Consumers int64  `json:"consumers"`
	Durable   bool   `json:"durable"`
}

type RabbitMQExchangeRow struct {
	Name       string `json:"name"`
	Vhost      string `json:"vhost"`
	Type       string `json:"type"`
	Durable    bool   `json:"durable"`
	AutoDelete bool   `json:"auto_delete"`
	Internal   bool   `json:"internal"`
}

type IoTMessageRequest struct {
	DeviceID   string `json:"device_id"`
	Payload    string `json:"payload"`
	TargetType string `json:"target_type"`
	Target     string `json:"target"`
	MQTTTopic  string `json:"mqtt_topic"`
	QoS        int    `json:"qos"`
}

type IoTEnvelope struct {
	Protocol   string `json:"protocol"`
	DeviceID   string `json:"device_id"`
	Payload    string `json:"payload"`
	IoTRole    string `json:"iot_role"`
	TargetType string `json:"target_type"`
	Target     string `json:"target"`
	MQTTTopic  string `json:"mqtt_topic,omitempty"`
	QoS        int    `json:"qos,omitempty"`
	ReceivedAt string `json:"received_at"`
}

func (h *Handler) KafkaConcepts(c echo.Context) error {
	return response.OK(c, kafkaConcepts())
}

func (h *Handler) RabbitMQConcepts(c echo.Context) error {
	return response.OK(c, rabbitMQConcepts())
}

func (h *Handler) IoTProtocolConcepts(c echo.Context) error {
	protocol, err := cleanIoTProtocol(c.Param("protocol"))
	if err != nil {
		return err
	}
	return response.OK(c, iotProtocolConcepts(protocol))
}

func (h *Handler) ListKafkaTopics(c echo.Context) error {
	logs := newStepLogs()
	logs.add("OK", "读取 KAFKA_BROKERS 配置: "+strings.Join(h.kafkaBrokers, ","))

	ctx, cancel := context.WithTimeout(c.Request().Context(), 12*time.Second)
	defer cancel()
	conn, err := kafka.DialContext(ctx, "tcp", h.firstKafkaBroker())
	if err != nil {
		logs.add("ERROR", "连接 Kafka 失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"topics": []KafkaTopicRow{}}, Concepts: kafkaConcepts()})
	}
	defer conn.Close()
	logs.add("OK", "已连接 Kafka broker，读取 topic/partition metadata")

	partitions, err := conn.ReadPartitions()
	if err != nil {
		logs.add("ERROR", "读取 topic 列表失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"topics": []KafkaTopicRow{}}, Concepts: kafkaConcepts()})
	}

	grouped := make(map[string][]kafka.Partition)
	for _, partition := range partitions {
		grouped[partition.Topic] = append(grouped[partition.Topic], partition)
	}

	topics := make([]KafkaTopicRow, 0, len(grouped))
	for topic, topicPartitions := range grouped {
		row := KafkaTopicRow{
			Topic:       topic,
			Partitions:  len(topicPartitions),
			FirstOffset: -1,
			LastOffset:  -1,
			Internal:    strings.HasPrefix(topic, "__"),
		}
		if len(topicPartitions) > 0 {
			row.Leader = formatBroker(topicPartitions[0].Leader)
		}
		for _, partition := range topicPartitions {
			firstOffset, lastOffset, err := h.partitionOffsets(ctx, topic, partition.ID)
			if err != nil {
				continue
			}
			if row.FirstOffset == -1 || firstOffset < row.FirstOffset {
				row.FirstOffset = firstOffset
			}
			if lastOffset > row.LastOffset {
				row.LastOffset = lastOffset
			}
			if lastOffset > firstOffset {
				row.MessageCount += lastOffset - firstOffset
			}
		}
		topics = append(topics, row)
	}
	sort.Slice(topics, func(i, j int) bool {
		if topics[i].Internal != topics[j].Internal {
			return !topics[i].Internal
		}
		return topics[i].Topic < topics[j].Topic
	})
	logs.add("OK", fmt.Sprintf("读取到 %d 个 topic；offset 范围来自 broker，不是接口日志", len(topics)))
	return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"topics": topics}, Concepts: kafkaConcepts()})
}

func (h *Handler) ListRabbitMQQueues(c echo.Context) error {
	logs := newStepLogs()
	var rows []RabbitMQQueueRow
	if err := h.rabbitManagementGET(c.Request().Context(), "/api/queues", &rows, logs); err != nil {
		logs.add("ERROR", "读取队列列表失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"queues": []RabbitMQQueueRow{}}, Concepts: rabbitMQConcepts()})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Vhost != rows[j].Vhost {
			return rows[i].Vhost < rows[j].Vhost
		}
		return rows[i].Name < rows[j].Name
	})
	logs.add("OK", fmt.Sprintf("读取到 %d 个 queue；messages 是 RabbitMQ 当前堆积数", len(rows)))
	return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"queues": rows}, Concepts: rabbitMQConcepts()})
}

func (h *Handler) ListRabbitMQExchanges(c echo.Context) error {
	logs := newStepLogs()
	var rows []RabbitMQExchangeRow
	if err := h.rabbitManagementGET(c.Request().Context(), "/api/exchanges", &rows, logs); err != nil {
		logs.add("ERROR", "读取 exchange 列表失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"exchanges": []RabbitMQExchangeRow{}}, Concepts: rabbitMQConcepts()})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Vhost != rows[j].Vhost {
			return rows[i].Vhost < rows[j].Vhost
		}
		return rows[i].Name < rows[j].Name
	})
	logs.add("OK", fmt.Sprintf("读取到 %d 个 exchange；空名称代表 default exchange", len(rows)))
	return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"exchanges": rows}, Concepts: rabbitMQConcepts()})
}

func (h *Handler) CreateKafkaTopic(c echo.Context) error {
	var req KafkaTopicRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	topic, err := cleanName(req.Topic, "topic")
	if err != nil {
		return err
	}
	partitions := req.Partitions
	if partitions < 1 {
		partitions = 1
	}
	if partitions > 12 {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "partitions must be between 1 and 12")
	}
	logs := newStepLogs()
	logs.add("OK", "读取 KAFKA_BROKERS 配置: "+strings.Join(h.kafkaBrokers, ","))

	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()
	conn, err := kafka.DialContext(ctx, "tcp", h.firstKafkaBroker())
	if err != nil {
		logs.add("ERROR", "连接 Kafka 失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"created": false}, Concepts: kafkaConcepts()})
	}
	defer conn.Close()
	logs.add("OK", "已连接 Kafka broker")

	err = conn.CreateTopics(kafkaTopicConfig(topic, partitions))
	if err != nil {
		if isTopicExists(err) {
			logs.add("OK", "topic 已存在，继续用于体验: "+topic)
			return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"topic": topic, "created": false, "partitions": partitions}, Concepts: kafkaConcepts()})
		}
		logs.add("ERROR", "创建 topic 失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"topic": topic, "created": false}, Concepts: kafkaConcepts()})
	}
	logs.add("OK", fmt.Sprintf("已创建 topic %s，分区数 %d", topic, partitions))
	return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"topic": topic, "created": true, "partitions": partitions}, Concepts: kafkaConcepts()})
}

func (h *Handler) SendKafkaMessage(c echo.Context) error {
	var req KafkaMessageRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	topic, err := cleanName(req.Topic, "topic")
	if err != nil {
		return err
	}
	if strings.TrimSpace(req.Value) == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "message is required")
	}
	logs := newStepLogs()
	logs.add("OK", "读取 KAFKA_BROKERS 配置: "+strings.Join(h.kafkaBrokers, ","))

	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()
	if !h.ensureKafkaTopic(ctx, topic, 1, logs) {
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"sent": false}, Concepts: kafkaConcepts()})
	}
	writer := &kafka.Writer{
		Addr:         kafka.TCP(h.kafkaBrokers...),
		Topic:        topic,
		RequiredAcks: kafka.RequireOne,
		Balancer:     &kafka.Hash{},
	}
	defer writer.Close()
	logs.add("OK", "已准备 Kafka producer")

	msg := kafka.Message{Key: []byte(req.Key), Value: []byte(req.Value), Time: time.Now()}
	if err := writer.WriteMessages(ctx, msg); err != nil {
		logs.add("ERROR", "发送消息失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"sent": false}, Concepts: kafkaConcepts()})
	}
	logs.add("OK", "消息已写入 topic。Kafka 中消息会保留，可按 offset 重复读取。")
	return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"sent": true, "topic": topic, "key": req.Key, "value": req.Value}, Concepts: kafkaConcepts()})
}

func (h *Handler) ConsumeKafkaMessages(c echo.Context) error {
	var req KafkaConsumeRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	topic, err := cleanName(req.Topic, "topic")
	if err != nil {
		return err
	}
	limit := req.Limit
	if limit < 1 {
		limit = 5
	}
	if limit > 100 {
		limit = 100
	}
	logs := newStepLogs()
	logs.add("OK", "读取 KAFKA_BROKERS 配置: "+strings.Join(h.kafkaBrokers, ","))

	ctx, cancel := context.WithTimeout(c.Request().Context(), 12*time.Second)
	defer cancel()
	conn, err := kafka.DialLeader(ctx, "tcp", h.firstKafkaBroker(), topic, 0)
	if err != nil {
		logs.add("ERROR", "连接 topic 分区失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"messages": []KafkaMessageRow{}}, Concepts: kafkaConcepts()})
	}
	defer conn.Close()
	logs.add("OK", "已连接 topic 的 partition 0")

	lastOffset, err := conn.ReadLastOffset()
	if err != nil {
		logs.add("ERROR", "读取最新 offset 失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"messages": []KafkaMessageRow{}}, Concepts: kafkaConcepts()})
	}
	startOffset := int64(0)
	if strings.EqualFold(req.Offset, "latest") {
		startOffset = lastOffset - int64(limit)
		if startOffset < 0 {
			startOffset = 0
		}
	} else if req.Offset != "" && !strings.EqualFold(req.Offset, "earliest") {
		parsed, parseErr := strconv.ParseInt(req.Offset, 10, 64)
		if parseErr != nil || parsed < 0 {
			return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "offset must be earliest, latest, or a non-negative number")
		}
		startOffset = parsed
	}
	if startOffset >= lastOffset {
		logs.add("OK", "当前没有可读取的新消息。Kafka 消费不会删除历史消息。")
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"messages": []KafkaMessageRow{}, "last_offset": lastOffset}, Concepts: kafkaConcepts()})
	}
	if _, err := conn.Seek(startOffset, 0); err != nil {
		logs.add("ERROR", "定位 offset 失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"messages": []KafkaMessageRow{}}, Concepts: kafkaConcepts()})
	}
	logs.add("OK", fmt.Sprintf("从 offset %d 开始读取，最多 %d 条", startOffset, limit))

	messages := make([]KafkaMessageRow, 0, limit)
	for len(messages) < limit {
		_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		msg, err := conn.ReadMessage(10e6)
		if err != nil {
			var netErr net.Error
			if errors.As(err, &netErr) && netErr.Timeout() {
				break
			}
			logs.add("ERROR", "读取消息失败: "+err.Error())
			break
		}
		messages = append(messages, KafkaMessageRow{
			Topic: topic, Partition: msg.Partition, Offset: msg.Offset,
			Key: string(msg.Key), Value: string(msg.Value), Time: formatTime(msg.Time),
		})
	}
	logs.add("OK", fmt.Sprintf("读取到 %d 条消息；再次用相同 offset 读取仍可看到这些消息", len(messages)))
	return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"messages": messages, "last_offset": lastOffset}, Concepts: kafkaConcepts()})
}

func (h *Handler) DeclareRabbitMQQueue(c echo.Context) error {
	var req RabbitMQQueueRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	queue, err := cleanName(req.Queue, "queue")
	if err != nil {
		return err
	}
	logs, conn, ch, err := h.rabbitChannel(c.Request().Context())
	if err != nil {
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"declared": false}, Concepts: rabbitMQConcepts()})
	}
	defer conn.Close()
	defer ch.Close()

	declared, err := ch.QueueDeclare(queue, true, false, false, false, nil)
	if err != nil {
		logs.add("ERROR", "声明队列失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"declared": false}, Concepts: rabbitMQConcepts()})
	}
	logs.add("OK", fmt.Sprintf("已声明队列 %s，当前消息数 %d", queue, declared.Messages))
	queueState := RabbitMQQueueRow{Name: declared.Name, Vhost: "/", Messages: int64(declared.Messages), Consumers: int64(declared.Consumers), Durable: true}
	return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"queue": queue, "declared": true, "messages": declared.Messages, "queue_state": queueState}, Concepts: rabbitMQConcepts()})
}

func (h *Handler) SendRabbitMQMessage(c echo.Context) error {
	var req RabbitMQMessageRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	queue, err := cleanName(req.Queue, "queue")
	if err != nil {
		return err
	}
	if strings.TrimSpace(req.Value) == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "message is required")
	}
	logs, conn, ch, err := h.rabbitChannel(c.Request().Context())
	if err != nil {
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"sent": false}, Concepts: rabbitMQConcepts()})
	}
	defer conn.Close()
	defer ch.Close()

	if _, err := ch.QueueDeclare(queue, true, false, false, false, nil); err != nil {
		logs.add("ERROR", "声明队列失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"sent": false}, Concepts: rabbitMQConcepts()})
	}
	logs.add("OK", "队列已就绪: "+queue)
	err = ch.PublishWithContext(c.Request().Context(), "", queue, false, false, amqp.Publishing{
		ContentType:  "text/plain",
		DeliveryMode: amqp.Persistent,
		Timestamp:    time.Now(),
		Body:         []byte(req.Value),
	})
	if err != nil {
		logs.add("ERROR", "发送消息失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"sent": false}, Concepts: rabbitMQConcepts()})
	}
	logs.add("OK", "消息已进入队列；RabbitMQ 消费并 ack 后消息会从队列中移除。")
	queueState, err := h.inspectRabbitMQQueue(ch, queue)
	if err != nil {
		logs.add("ERROR", "读取队列最新状态失败: "+err.Error())
	}
	return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"sent": true, "queue": queue, "value": req.Value, "queue_state": queueState}, Concepts: rabbitMQConcepts()})
}

func (h *Handler) ConsumeRabbitMQMessage(c echo.Context) error {
	var req RabbitMQConsumeRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	queue, err := cleanName(req.Queue, "queue")
	if err != nil {
		return err
	}
	logs, conn, ch, err := h.rabbitChannel(c.Request().Context())
	if err != nil {
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"message": nil}, Concepts: rabbitMQConcepts()})
	}
	defer conn.Close()
	defer ch.Close()

	if _, err := ch.QueueDeclare(queue, true, false, false, false, nil); err != nil {
		logs.add("ERROR", "声明队列失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"message": nil}, Concepts: rabbitMQConcepts()})
	}
	logs.add("OK", "队列已就绪: "+queue)
	msg, ok, err := ch.Get(queue, false)
	if err != nil {
		logs.add("ERROR", "消费消息失败: "+err.Error())
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"message": nil}, Concepts: rabbitMQConcepts()})
	}
	if !ok {
		logs.add("OK", "队列为空，没有可消费消息。")
		queueState, err := h.inspectRabbitMQQueue(ch, queue)
		if err != nil {
			logs.add("ERROR", "读取队列最新状态失败: "+err.Error())
		}
		return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"message": nil, "queue_state": queueState}, Concepts: rabbitMQConcepts()})
	}
	if req.Ack {
		if err := msg.Ack(false); err != nil {
			logs.add("ERROR", "ack 失败: "+err.Error())
		} else {
			logs.add("OK", "已 ack，消息会从 RabbitMQ 队列中移除。")
		}
	} else {
		if err := msg.Nack(false, true); err != nil {
			logs.add("ERROR", "nack 失败: "+err.Error())
		} else {
			logs.add("OK", "未 ack，已 requeue，下一次仍可能取到这条消息。")
		}
	}
	row := RabbitMQMessageRow{Queue: queue, DeliveryTag: msg.DeliveryTag, Value: string(msg.Body), Redelivered: msg.Redelivered, Time: formatTime(time.Now())}
	queueState, err := h.inspectRabbitMQQueue(ch, queue)
	if err != nil {
		logs.add("ERROR", "读取队列最新状态失败: "+err.Error())
	}
	return response.OK(c, OperationResponse{Logs: logs.items, Result: map[string]any{"message": row, "queue_state": queueState}, Concepts: rabbitMQConcepts()})
}

func (h *Handler) SendIoTProtocolMessage(c echo.Context) error {
	protocol, err := cleanIoTProtocol(c.Param("protocol"))
	if err != nil {
		return err
	}
	var req IoTMessageRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	envelope, body, err := buildIoTEnvelope(protocol, req)
	if err != nil {
		return err
	}

	logs := newStepLogs()
	logs.add("OK", iotIngressLog(protocol, envelope))
	ctx, cancel := context.WithTimeout(c.Request().Context(), 10*time.Second)
	defer cancel()

	delivered := false
	switch envelope.TargetType {
	case "kafka":
		delivered = h.publishKafka(ctx, envelope.Target, envelope.DeviceID, body, logs)
	case "rabbitmq":
		delivered = h.publishRabbitMQ(ctx, envelope.Target, body, logs)
	default:
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "target_type must be kafka or rabbitmq")
	}
	if delivered {
		logs.add("OK", "物联网协议消息已完成桥接，现可到对应 Kafka/RabbitMQ 体验页消费。")
	}
	return response.OK(c, OperationResponse{
		Logs:     logs.items,
		Result:   map[string]any{"delivered": delivered, "protocol": protocol, "target_type": envelope.TargetType, "target": envelope.Target, "envelope": envelope, "message": body},
		Concepts: iotProtocolConcepts(protocol),
	})
}

func (h *Handler) firstKafkaBroker() string {
	if len(h.kafkaBrokers) == 0 {
		return "localhost:9092"
	}
	return h.kafkaBrokers[0]
}

func (h *Handler) partitionOffsets(ctx context.Context, topic string, partition int) (int64, int64, error) {
	conn, err := kafka.DialLeader(ctx, "tcp", h.firstKafkaBroker(), topic, partition)
	if err != nil {
		return 0, 0, err
	}
	defer conn.Close()
	firstOffset, err := conn.ReadFirstOffset()
	if err != nil {
		return 0, 0, err
	}
	lastOffset, err := conn.ReadLastOffset()
	if err != nil {
		return 0, 0, err
	}
	return firstOffset, lastOffset, nil
}

func (h *Handler) publishKafka(ctx context.Context, topic string, key string, value string, logs *stepLogs) bool {
	logs.add("OK", "读取 KAFKA_BROKERS 配置: "+strings.Join(h.kafkaBrokers, ","))
	if !h.ensureKafkaTopic(ctx, topic, 1, logs) {
		return false
	}
	writer := &kafka.Writer{
		Addr:         kafka.TCP(h.kafkaBrokers...),
		Topic:        topic,
		RequiredAcks: kafka.RequireOne,
		Balancer:     &kafka.Hash{},
	}
	defer writer.Close()
	logs.add("OK", "已准备 Kafka producer，目标 topic: "+topic)
	if err := writer.WriteMessages(ctx, kafka.Message{Key: []byte(key), Value: []byte(value), Time: time.Now()}); err != nil {
		logs.add("ERROR", "写入 Kafka 失败: "+err.Error())
		return false
	}
	logs.add("OK", "消息已写入 Kafka topic，可按 offset 读取。")
	return true
}

func (h *Handler) ensureKafkaTopic(ctx context.Context, topic string, partitions int, logs *stepLogs) bool {
	config := kafkaTopicConfig(topic, partitions)
	conn, err := kafka.DialContext(ctx, "tcp", h.firstKafkaBroker())
	if err != nil {
		logs.add("ERROR", "连接 Kafka 以确认 topic 失败: "+err.Error())
		return false
	}
	defer conn.Close()
	logs.add("OK", fmt.Sprintf("已连接 Kafka，确认 topic %s", topic))
	if err := conn.CreateTopics(config); err != nil {
		if isTopicExists(err) {
			logs.add("OK", "topic 已存在，继续写入: "+topic)
			return true
		}
		logs.add("ERROR", "确认 topic 失败: "+err.Error())
		return false
	}
	logs.add("OK", fmt.Sprintf("topic 不存在，已自动创建 %s，分区数 %d", topic, config.NumPartitions))
	return true
}

func (h *Handler) publishRabbitMQ(ctx context.Context, queue string, value string, logs *stepLogs) bool {
	logs.add("OK", "读取 RABBITMQ_URL 配置")
	conn, err := amqp.DialConfig(h.rabbitMQURL, amqp.Config{Dial: amqp.DefaultDial(8 * time.Second)})
	if err != nil {
		logs.add("ERROR", "连接 RabbitMQ 失败: "+err.Error())
		return false
	}
	defer conn.Close()
	logs.add("OK", "已连接 RabbitMQ")
	ch, err := conn.Channel()
	if err != nil {
		logs.add("ERROR", "打开 channel 失败: "+err.Error())
		return false
	}
	defer ch.Close()
	if _, err := ch.QueueDeclare(queue, true, false, false, false, nil); err != nil {
		logs.add("ERROR", "声明队列失败: "+err.Error())
		return false
	}
	logs.add("OK", "队列已就绪: "+queue)
	if err := ch.PublishWithContext(ctx, "", queue, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Timestamp:    time.Now(),
		Body:         []byte(value),
	}); err != nil {
		logs.add("ERROR", "写入 RabbitMQ 失败: "+err.Error())
		return false
	}
	logs.add("OK", "消息已进入 RabbitMQ queue，消费并 ack 后会移除。")
	return true
}

func (h *Handler) rabbitManagementGET(ctx context.Context, path string, target any, logs *stepLogs) error {
	if h.rabbitMQManagementURL == "" {
		return errors.New("RABBITMQ_MANAGEMENT_URL is empty")
	}
	logs.add("OK", "读取 RabbitMQ Management API 配置")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, h.rabbitMQManagementURL+path, nil)
	if err != nil {
		return err
	}
	req.SetBasicAuth(h.rabbitMQManagementUser, h.rabbitMQManagementPass)
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("management api status %d", resp.StatusCode)
	}
	logs.add("OK", "RabbitMQ Management API 已返回当前状态")
	return json.NewDecoder(resp.Body).Decode(target)
}

func (h *Handler) inspectRabbitMQQueue(ch *amqp.Channel, queue string) (*RabbitMQQueueRow, error) {
	declared, err := ch.QueueInspect(queue)
	if err != nil {
		return nil, err
	}
	return &RabbitMQQueueRow{Name: declared.Name, Vhost: "/", Messages: int64(declared.Messages), Consumers: int64(declared.Consumers), Durable: true}, nil
}

func (h *Handler) rabbitChannel(ctx context.Context) (*stepLogs, *amqp.Connection, *amqp.Channel, error) {
	logs := newStepLogs()
	logs.add("OK", "读取 RABBITMQ_URL 配置")
	conn, err := amqp.DialConfig(h.rabbitMQURL, amqp.Config{Dial: amqp.DefaultDial(8 * time.Second)})
	if err != nil {
		logs.add("ERROR", "连接 RabbitMQ 失败: "+err.Error())
		return logs, nil, nil, err
	}
	logs.add("OK", "已连接 RabbitMQ")
	ch, err := conn.Channel()
	if err != nil {
		_ = conn.Close()
		logs.add("ERROR", "打开 channel 失败: "+err.Error())
		return logs, nil, nil, err
	}
	_ = ctx
	logs.add("OK", "已打开 RabbitMQ channel")
	return logs, conn, ch, nil
}

type stepLogs struct {
	items []StepLog
}

func newStepLogs() *stepLogs {
	return &stepLogs{items: make([]StepLog, 0, 8)}
}

func (l *stepLogs) add(status string, detail string) {
	l.items = append(l.items, StepLog{Step: len(l.items) + 1, Status: status, Detail: detail, At: formatTime(time.Now())})
}

func kafkaConcepts() ConceptData {
	return ConceptData{
		Shared:      []string{"发送消息", "消费者读取消息", "适合异步解耦"},
		Differences: []string{"Kafka 写入 topic，topic 再分成 partition", "每条消息有 offset，按 offset 保留", "消费后不会被取走，可用 offset 重复读取", "更适合事件流、日志和回放"},
	}
}

func rabbitMQConcepts() ConceptData {
	return ConceptData{
		Shared:      []string{"发送消息", "消费者读取消息", "适合异步解耦"},
		Differences: []string{"RabbitMQ 消息先到 exchange，再路由到 queue；本体验使用 default exchange", "消费者处理后 ack", "ack 后消息会被取走", "更适合任务分发、工作队列和即时处理"},
	}
}

func iotProtocolConcepts(protocol string) ConceptData {
	switch protocol {
	case "tcp":
		return ConceptData{
			Shared:      []string{"IoT 设备上报遥测数据", "协议网关接入设备消息", "网关再桥接到 Kafka 或 RabbitMQ 供业务消费"},
			Differences: []string{"TCP 面向连接，适合网关和设备保持长连接", "适合需要顺序、可靠传输的电表、充电桩、工业控制器", "网关收到连续数据帧后通常写入 Kafka 事件流或 RabbitMQ 工作队列"},
		}
	case "udp":
		return ConceptData{
			Shared:      []string{"IoT 设备上报遥测数据", "协议网关接入设备消息", "网关再桥接到 Kafka 或 RabbitMQ 供业务消费"},
			Differences: []string{"UDP 无连接，单个数据报开销低、延迟低", "适合频繁上报、可容忍少量丢包的传感器心跳和位置点", "业务侧通常依赖 Kafka/RabbitMQ 做削峰、重试和后续处理"},
		}
	case "mqtt":
		return ConceptData{
			Shared:      []string{"IoT 设备上报遥测数据", "协议网关接入设备消息", "网关再桥接到 Kafka 或 RabbitMQ 供业务消费"},
			Differences: []string{"MQTT 使用发布/订阅和主题，设备按 topic 上报状态", "适合弱网、低功耗设备，支持 QoS 语义", "平台常把 MQTT topic 消息桥接到 Kafka 或 RabbitMQ，让业务服务按队列消费"},
		}
	default:
		return ConceptData{Shared: []string{}, Differences: []string{}}
	}
}

func buildIoTEnvelope(protocol string, req IoTMessageRequest) (IoTEnvelope, string, error) {
	protocol, err := cleanIoTProtocol(protocol)
	if err != nil {
		return IoTEnvelope{}, "", err
	}
	deviceID, err := cleanName(req.DeviceID, "device_id")
	if err != nil {
		return IoTEnvelope{}, "", err
	}
	if strings.TrimSpace(req.Payload) == "" {
		return IoTEnvelope{}, "", response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "payload is required")
	}
	targetType := strings.ToLower(strings.TrimSpace(req.TargetType))
	if targetType == "" {
		targetType = "kafka"
	}
	if targetType != "kafka" && targetType != "rabbitmq" {
		return IoTEnvelope{}, "", response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "target_type must be kafka or rabbitmq")
	}
	target, err := cleanName(req.Target, "target")
	if err != nil {
		return IoTEnvelope{}, "", err
	}
	qos := req.QoS
	if qos < 0 || qos > 2 {
		return IoTEnvelope{}, "", response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "qos must be between 0 and 2")
	}
	mqttTopic := strings.TrimSpace(req.MQTTTopic)
	if protocol == "mqtt" && mqttTopic == "" {
		mqttTopic = "devices/" + deviceID + "/telemetry"
	}
	envelope := IoTEnvelope{
		Protocol: protocol, DeviceID: deviceID, Payload: strings.TrimSpace(req.Payload),
		IoTRole: protocolIoTRole(protocol), TargetType: targetType, Target: target,
		MQTTTopic: mqttTopic, QoS: qos, ReceivedAt: formatTime(time.Now()),
	}
	body, err := json.Marshal(envelope)
	if err != nil {
		return IoTEnvelope{}, "", err
	}
	return envelope, string(body), nil
}

func cleanIoTProtocol(protocol string) (string, error) {
	value := strings.ToLower(strings.TrimSpace(protocol))
	switch value {
	case "tcp", "udp", "mqtt":
		return value, nil
	default:
		return "", response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "protocol must be tcp, udp, or mqtt")
	}
}

func protocolIoTRole(protocol string) string {
	switch protocol {
	case "tcp":
		return "设备与网关保持长连接，适合可靠、顺序的数据帧上报"
	case "udp":
		return "设备发送轻量数据报，适合高频、低延迟、可容忍丢包的遥测"
	case "mqtt":
		return "设备按主题发布消息，适合弱网和低功耗设备的发布/订阅"
	default:
		return ""
	}
}

func iotIngressLog(protocol string, envelope IoTEnvelope) string {
	switch protocol {
	case "tcp":
		return fmt.Sprintf("模拟 TCP 设备长连接收到数据帧，device=%s", envelope.DeviceID)
	case "udp":
		return fmt.Sprintf("模拟 UDP 网关收到单个数据报，device=%s", envelope.DeviceID)
	case "mqtt":
		return fmt.Sprintf("模拟 MQTT broker 收到主题 %s 的发布消息，device=%s", envelope.MQTTTopic, envelope.DeviceID)
	default:
		return fmt.Sprintf("收到 IoT 协议消息，device=%s", envelope.DeviceID)
	}
}

func formatBroker(broker kafka.Broker) string {
	if broker.Host == "" || broker.Port == 0 {
		return fmt.Sprintf("broker-%d", broker.ID)
	}
	return fmt.Sprintf("%s:%d", broker.Host, broker.Port)
}

func kafkaTopicConfig(topic string, partitions int) kafka.TopicConfig {
	if partitions < 1 {
		partitions = 1
	}
	return kafka.TopicConfig{Topic: topic, NumPartitions: partitions, ReplicationFactor: 1}
}

func cleanName(value string, label string) (string, error) {
	name := strings.TrimSpace(value)
	if name == "" {
		return "", response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", label+" is required")
	}
	if len(name) > 120 {
		return "", response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", label+" is too long")
	}
	if strings.ContainsAny(name, " \t\r\n") {
		return "", response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", label+" cannot contain whitespace")
	}
	return name, nil
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	if len(out) == 0 {
		return []string{"localhost:9092"}
	}
	return out
}

func isTopicExists(err error) bool {
	text := strings.ToLower(err.Error())
	return strings.Contains(text, "already exists") || strings.Contains(text, "topic with this name already exists")
}

func formatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Local().Format("2006-01-02 15:04:05")
}
