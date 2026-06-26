package http

import (
	"log/slog"
	"net/http"

	"enterprise-demo/backend/internal/config"
	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"
	"enterprise-demo/backend/internal/modules/auditlog"
	authmodule "enterprise-demo/backend/internal/modules/auth"
	"enterprise-demo/backend/internal/modules/collaboration"
	"enterprise-demo/backend/internal/modules/customer"
	"enterprise-demo/backend/internal/modules/datadict"
	"enterprise-demo/backend/internal/modules/knowledgebase"
	"enterprise-demo/backend/internal/modules/monitor"
	"enterprise-demo/backend/internal/modules/recyclebin"
	"enterprise-demo/backend/internal/modules/scheduler"
	"enterprise-demo/backend/internal/modules/department"
	filemodule "enterprise-demo/backend/internal/modules/file"
	"enterprise-demo/backend/internal/modules/health"
	"enterprise-demo/backend/internal/modules/menu"
	"enterprise-demo/backend/internal/modules/role"
	"enterprise-demo/backend/internal/modules/settings"
	"enterprise-demo/backend/internal/modules/user"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
	emiddleware "github.com/labstack/echo/v4/middleware"
)

func NewServer(cfg config.Config, log *slog.Logger, db *pgxpool.Pool) *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.HTTPErrorHandler = response.ErrorHandler(log)

	e.Use(middleware.RequestID())
	e.Use(middleware.RequestLogger(log))
	e.Use(emiddleware.Recover())
	e.Use(emiddleware.CORSWithConfig(emiddleware.CORSConfig{
		AllowOrigins: []string{cfg.AllowedOrigin},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization, "X-Request-ID"},
	}))
	e.Use(middleware.Audit(db))

	e.GET("/health", health.Handle)

	api := e.Group("/api/v1")
	api.GET("/health", health.Handle)

	authmodule.NewHandler(db, cfg.JWTSecret).Register(api)
	user.NewHandler(db, cfg.JWTSecret).Register(api)
	role.NewHandler(db, cfg.JWTSecret).Register(api)
	menu.NewHandler(db, cfg.JWTSecret).Register(api)
	department.NewHandler(db, cfg.JWTSecret).Register(api)
	customer.NewHandler(db, cfg.JWTSecret).Register(api)
	filemodule.NewHandler(db, cfg.JWTSecret, cfg.UploadDir).Register(api)
	auditlog.NewHandler(db, cfg.JWTSecret).Register(api)
	settings.NewHandler(db, cfg.JWTSecret).Register(api)
	collaboration.NewHandler(db, cfg.JWTSecret).Register(api)
	datadict.NewHandler(db, cfg.JWTSecret).Register(api)
	recyclebin.NewHandler(db, cfg.JWTSecret).Register(api)
	monitor.NewHandler(db, cfg.JWTSecret).Register(api)
	scheduler.NewHandler(db, cfg.JWTSecret).Register(api)
	knowledgebase.NewHandler(db, cfg.JWTSecret).Register(api)

	return e
}
