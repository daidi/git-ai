package config

import "testing"

func TestSchemaCoversEveryConfigKey(t *testing.T) {
	schema := Schema()
	if schema.Version != SchemaVersion {
		t.Fatalf("schema version = %d, want %d", schema.Version, SchemaVersion)
	}
	seen := make(map[string]bool, len(schema.Fields))
	for _, field := range schema.Fields {
		if seen[field.Key] {
			t.Fatalf("duplicate schema field %q", field.Key)
		}
		seen[field.Key] = true
	}
	for _, key := range ValidKeys() {
		if !seen[key] {
			t.Errorf("config key %q is missing from schema", key)
		}
	}
	if len(seen) != len(ValidKeys()) {
		t.Fatalf("schema has %d fields, config has %d keys", len(seen), len(ValidKeys()))
	}
}

func TestSchemaProviderDefaultsAreValid(t *testing.T) {
	for _, provider := range Schema().Providers {
		cfg := &Config{}
		if err := SetValue(cfg, "provider", provider.ID); err != nil {
			t.Errorf("provider %q is invalid: %v", provider.ID, err)
		}
		if provider.DefaultBaseURL == "" || provider.DefaultModel == "" {
			t.Errorf("provider %q has incomplete defaults", provider.ID)
		}
	}
}
