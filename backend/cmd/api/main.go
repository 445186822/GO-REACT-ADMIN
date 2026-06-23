package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"enterprise-demo/backend/internal/config"
	"enterprise-demo/backend/internal/database"
	apphttp "enterprise-demo/backend/internal/http"
	"enterprise-demo/backend/internal/logger"
)

func main() {
	cfg := config.Load()
	log := logger.New(cfg.AppEnv)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := database.Migrate(ctx, db, "migrations"); err != nil {
		log.Error("database migration failed", "error", err)
		os.Exit(1)
	}
	if err := database.Seed(ctx, db, cfg.InitialAdminPassword); err != nil {
		log.Error("database seed failed", "error", err)
		os.Exit(1)
	}

	server := apphttp.NewServer(cfg, log, db)

	go func() {
		log.Info("api server starting", "addr", cfg.HTTPAddr)
		if err := server.Start(cfg.HTTPAddr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("api server failed", "error", err)
			os.Exit(1)
		}
	}()

	shutdownCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-shutdownCtx.Done()

	shutdownTimeoutCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownTimeoutCtx); err != nil {
		log.Error("api server shutdown failed", "error", err)
		os.Exit(1)
	}

	log.Info("api server stopped")
}
