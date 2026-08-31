package ai

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type ErrorKind string

const (
	ErrorNetwork         ErrorKind = "network"
	ErrorTimeout         ErrorKind = "timeout"
	ErrorAuthentication  ErrorKind = "authentication"
	ErrorRateLimit       ErrorKind = "rate_limit"
	ErrorModel           ErrorKind = "model"
	ErrorProvider        ErrorKind = "provider"
	ErrorInvalidResponse ErrorKind = "invalid_response"
	ErrorCanceled        ErrorKind = "canceled"
)

// ProviderError keeps machine-readable failure information without embedding
// request bodies, prompts, diffs, credentials, or arbitrary response payloads.
type ProviderError struct {
	Kind       ErrorKind
	StatusCode int
	Message    string
	RetryAfter time.Duration
	Err        error
}

func (e *ProviderError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	if e.StatusCode != 0 {
		return fmt.Sprintf("provider request failed with HTTP %d", e.StatusCode)
	}
	return "provider request failed"
}

func (e *ProviderError) Unwrap() error { return e.Err }

type Failure struct {
	Code      string
	Category  string
	Message   string
	Retryable bool
}

func DescribeError(err error) Failure {
	if err == nil {
		return Failure{}
	}
	if errors.Is(err, context.Canceled) {
		return Failure{Code: "canceled", Category: string(ErrorCanceled), Message: "Polishing was canceled. The commit was left unchanged.", Retryable: true}
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return Failure{Code: "request_timeout", Category: string(ErrorTimeout), Message: "The model request timed out. The commit was left unchanged; retry when the connection is stable.", Retryable: true}
	}
	var providerErr *ProviderError
	if errors.As(err, &providerErr) {
		failure := Failure{Code: string(providerErr.Kind), Category: string(providerErr.Kind), Retryable: IsRetryable(err)}
		switch providerErr.Kind {
		case ErrorAuthentication:
			failure.Message = "The model provider rejected the credentials. Check the user-level API key; the commit was left unchanged."
		case ErrorRateLimit:
			failure.Message = "The model provider is rate-limiting requests. The commit was left unchanged; retry later."
		case ErrorModel:
			failure.Message = "The configured model or endpoint is unavailable. Check provider settings; the commit was left unchanged."
		case ErrorProvider:
			failure.Message = "The model provider is temporarily unavailable. The commit was left unchanged; retry later."
		case ErrorInvalidResponse:
			failure.Message = "The model returned an unusable response. The commit was left unchanged; retry or choose another model."
		case ErrorTimeout:
			failure.Message = "The model request timed out. The commit was left unchanged; retry when the connection is stable."
		default:
			failure.Message = "The model request could not reach the provider. The commit was left unchanged; retry when the network is available."
		}
		return failure
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return Failure{Code: "network", Category: string(ErrorNetwork), Message: "The model request could not reach the provider. The commit was left unchanged; retry when the network is available.", Retryable: true}
	}
	return Failure{Code: "model_error", Category: string(ErrorModel), Message: "Polishing failed. The commit was left unchanged; review the Git AI logs and configuration.", Retryable: false}
}

func IsRetryable(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var providerErr *ProviderError
	if errors.As(err, &providerErr) {
		switch providerErr.Kind {
		case ErrorNetwork, ErrorTimeout, ErrorRateLimit, ErrorProvider, ErrorInvalidResponse:
			return true
		default:
			return false
		}
	}
	var netErr net.Error
	return errors.As(err, &netErr)
}

func classifyHTTPStatus(status int, retryAfter string) *ProviderError {
	err := &ProviderError{StatusCode: status, RetryAfter: parseRetryAfter(retryAfter)}
	switch {
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		err.Kind, err.Message = ErrorAuthentication, "provider authentication failed"
	case status == http.StatusNotFound || status == http.StatusBadRequest || status == http.StatusUnprocessableEntity:
		err.Kind, err.Message = ErrorModel, "configured model or endpoint was rejected"
	case status == http.StatusRequestTimeout || status == http.StatusGatewayTimeout:
		err.Kind, err.Message = ErrorTimeout, "provider request timed out"
	case status == http.StatusTooManyRequests:
		err.Kind, err.Message = ErrorRateLimit, "provider rate limit exceeded"
	case status >= 500:
		err.Kind, err.Message = ErrorProvider, "provider is temporarily unavailable"
	default:
		err.Kind, err.Message = ErrorModel, fmt.Sprintf("provider request failed with HTTP %d", status)
	}
	return err
}

func classifyTransportError(err error) error {
	if errors.Is(err, context.Canceled) {
		return context.Canceled
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return &ProviderError{Kind: ErrorTimeout, Message: "provider request timed out", Err: err}
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return &ProviderError{Kind: ErrorTimeout, Message: "provider request timed out", Err: err}
	}
	return &ProviderError{Kind: ErrorNetwork, Message: "provider network request failed", Err: err}
}

func parseRetryAfter(value string) time.Duration {
	if value == "" {
		return 0
	}
	if seconds, err := strconv.Atoi(strings.TrimSpace(value)); err == nil && seconds >= 0 {
		return time.Duration(seconds) * time.Second
	}
	if when, err := http.ParseTime(value); err == nil {
		if delay := time.Until(when); delay > 0 {
			return delay
		}
	}
	return 0
}

func retryAfter(err error) time.Duration {
	var providerErr *ProviderError
	if errors.As(err, &providerErr) {
		return providerErr.RetryAfter
	}
	return 0
}
