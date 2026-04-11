// Package notify provides system toast notifications.
package notify

import (
	"log"

	"github.com/gen2brain/beeep"
)

// Send displays a system toast notification.
// Failures are logged but do not cause errors — notifications are best-effort.
func Send(title, message string) {
	if err := beeep.Notify(title, message, ""); err != nil {
		log.Printf("notification error: %v", err)
	}
}
