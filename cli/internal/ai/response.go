package ai

import (
	"fmt"
	"io"
)

const maxProviderResponseBytes int64 = 1 << 20

func readProviderResponse(reader io.Reader) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(reader, maxProviderResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}
	if int64(len(data)) > maxProviderResponseBytes {
		return nil, &ProviderError{Kind: ErrorInvalidResponse, Message: "provider response exceeded the safety limit"}
	}
	return data, nil
}
