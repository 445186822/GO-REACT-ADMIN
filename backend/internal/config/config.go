package config

import (
	"bufio"
	"os"
	"strings"
)

type Config struct {
	AppName                string
	AppEnv                 string
	HTTPAddr               string
	DatabaseURL            string
	RedisAddr              string
	JWTSecret              string
	AllowedOrigin          string
	InitialAdminPassword   string
	UploadDir              string
	AutoMigrate            bool
	AutoSeed               bool
	SchedulerEnabled       bool
	AIAssistantEndpoint    string
	AIAssistantAPIKey      string
	AIStreamBaseURL        string
	AIStreamAPIKey         string
	AIStreamModel          string
	KafkaBrokers           string
	RabbitMQURL            string
	RabbitMQManagementURL  string
	RabbitMQManagementUser string
	RabbitMQManagementPass string
}

func (c Config) AllowedOrigins() []string {
	parts := strings.Split(c.AllowedOrigin, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		origin := strings.TrimSpace(part)
		if origin != "" {
			origins = append(origins, origin)
		}
	}
	if len(origins) == 0 {
		return []string{"http://localhost:5173"}
	}
	return origins
}

func Load() Config {
	loadDotEnv(".env")

	return Config{
		AppName:                getEnv("APP_NAME", "Enterprise Demo"),
		AppEnv:                 getEnv("APP_ENV", "development"),
		HTTPAddr:               getEnv("HTTP_ADDR", ":8080"),
		DatabaseURL:            getEnv("DATABASE_URL", "postgres://enterprise:enterprise@localhost:5432/enterprise_demo?sslmode=disable"),
		RedisAddr:              getEnv("REDIS_ADDR", "localhost:6379"),
		JWTSecret:              getEnv("JWT_SECRET", "change-me-in-production"),
		AllowedOrigin:          getEnv("ALLOWED_ORIGIN", "http://localhost:5173"),
		InitialAdminPassword:   getEnv("INITIAL_ADMIN_PASSWORD", ""),
		UploadDir:              getEnv("UPLOAD_DIR", "uploads"),
		AutoMigrate:            getEnvBool("AUTO_MIGRATE", true),
		AutoSeed:               getEnvBool("AUTO_SEED", true),
		SchedulerEnabled:       getEnvBool("SCHEDULER_ENABLED", true),
		AIAssistantEndpoint:    getEnv("AI_ASSISTANT_ENDPOINT", ""),
		AIAssistantAPIKey:      getEnv("AI_ASSISTANT_API_KEY", ""),
		AIStreamBaseURL:        getEnv("AI_STREAM_BASE_URL", "https://api.deepseek.com/anthropic"),
		AIStreamAPIKey:         firstEnv([]string{"AI_STREAM_API_KEY", "AI_API_KEY", "AI_ASSISTANT_API_KEY"}, ""),
		AIStreamModel:          getEnv("AI_STREAM_MODEL", "deepseek-v4-flash"),
		KafkaBrokers:           getEnv("KAFKA_BROKERS", "localhost:9092"),
		RabbitMQURL:            getEnv("RABBITMQ_URL", "amqp://admin:admin123@localhost:5672/"),
		RabbitMQManagementURL:  getEnv("RABBITMQ_MANAGEMENT_URL", "http://localhost:15672"),
		RabbitMQManagementUser: getEnv("RABBITMQ_MANAGEMENT_USER", "admin"),
		RabbitMQManagementPass: getEnv("RABBITMQ_MANAGEMENT_PASS", "admin123"),
	}
}

func loadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"`)
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, value)
		}
	}
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func firstEnv(keys []string, fallback string) string {
	for _, key := range keys {
		value := os.Getenv(key)
		if value != "" {
			return value
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if value == "" {
		return fallback
	}
	switch value {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return fallback
	}
}
