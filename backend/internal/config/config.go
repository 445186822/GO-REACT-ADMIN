package config

import "os"
import (
	"bufio"
	"strings"
)

type Config struct {
	AppName              string
	AppEnv               string
	HTTPAddr             string
	DatabaseURL          string
	RedisAddr            string
	JWTSecret            string
	AllowedOrigin        string
	InitialAdminPassword string
	UploadDir            string
}

func Load() Config {
	loadDotEnv(".env")
	loadDotEnv("../.env")

	return Config{
		AppName:              getEnv("APP_NAME", "Enterprise Demo"),
		AppEnv:               getEnv("APP_ENV", "development"),
		HTTPAddr:             getEnv("HTTP_ADDR", ":8080"),
		DatabaseURL:          getEnv("DATABASE_URL", "postgres://enterprise:enterprise@localhost:5432/enterprise_demo?sslmode=disable"),
		RedisAddr:            getEnv("REDIS_ADDR", "localhost:6379"),
		JWTSecret:            getEnv("JWT_SECRET", "change-me-in-production"),
		AllowedOrigin:        getEnv("ALLOWED_ORIGIN", "http://localhost:5173"),
		InitialAdminPassword: getEnv("INITIAL_ADMIN_PASSWORD", ""),
		UploadDir:            getEnv("UPLOAD_DIR", "uploads"),
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
