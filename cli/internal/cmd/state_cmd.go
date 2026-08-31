package cmd

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/cli/internal/config"
	"github.com/daidi/git-ai/cli/internal/git"
	"github.com/daidi/git-ai/cli/internal/hooks"
	"github.com/daidi/git-ai/cli/internal/state"
)

var statusJSON bool
var clearSkipNext bool

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show Git AI runtime status",
	RunE: func(cmd *cobra.Command, args []string) error {
		mgr, err := currentStateManager()
		if err != nil {
			return err
		}
		s, err := mgr.Load()
		if err != nil {
			return err
		}
		if statusJSON {
			data, err := json.Marshal(s)
			if err != nil {
				return err
			}
			var output map[string]any
			if err := json.Unmarshal(data, &output); err != nil {
				return err
			}
			output["state_path"] = mgr.StatePath()
			output["log_dir"] = mgr.LogDir()
			output["config_path"] = config.GlobalConfigPath()
			output["initialized"] = hooksInstalled()
			encoded, err := json.Marshal(output)
			if err != nil {
				return err
			}
			fmt.Println(string(encoded))
			return nil
		}
		fmt.Printf("status: %s\n", s.CurrentStatus)
		if s.LastSHA != "" {
			fmt.Printf("commit: %s\n", s.LastSHA)
		}
		if s.LastError != nil {
			fmt.Printf("last error: %s\n", s.LastError.Message)
		}
		return nil
	},
}

var cancelCmd = &cobra.Command{
	Use:   "cancel",
	Short: "Cancel the active polishing operation without changing Git",
	RunE: func(cmd *cobra.Command, args []string) error {
		mgr, err := currentStateManager()
		if err != nil {
			return err
		}
		pid := 0
		canceled := false
		_, err = mgr.Update(func(s *state.State) (bool, error) {
			if s.CurrentStatus != state.StatusPolishing || s.OperationID == "" {
				return false, nil
			}
			pid = s.PID
			canceled = true
			s.CurrentStatus = state.StatusIdle
			s.OperationID = ""
			s.PID = 0
			s.StartedAt = 0
			s.LastError = nil
			return true, nil
		})
		if err != nil {
			return err
		}
		if !canceled {
			fmt.Println("No polishing operation is running.")
			return nil
		}
		stopProcess(pid)
		fmt.Println("Polishing canceled. The commit and workspace were left unchanged.")
		return nil
	},
}

var skipNextCmd = &cobra.Command{
	Use:   "skip-next",
	Short: "Skip polishing for the next commit",
	RunE: func(cmd *cobra.Command, args []string) error {
		mgr, err := currentStateManager()
		if err != nil {
			return err
		}
		_, err = mgr.Update(func(s *state.State) (bool, error) {
			s.SkipNext = !clearSkipNext
			return true, nil
		})
		if err == nil {
			if clearSkipNext {
				fmt.Println("The next commit will be polished normally.")
			} else {
				fmt.Println("The next commit will not be polished.")
			}
		}
		return err
	},
}

var pushCmd = &cobra.Command{
	Use:   "push",
	Short: "Resume a deferred push, or push the current branch",
	RunE:  runPush,
}

func init() {
	statusCmd.Flags().BoolVar(&statusJSON, "json", false, "Print JSON")
	skipNextCmd.Flags().BoolVar(&clearSkipNext, "clear", false, "Clear the skip-next flag")
	rootCmd.AddCommand(statusCmd, cancelCmd, skipNextCmd, pushCmd)
}

func hooksInstalled() bool {
	path, err := git.GetHookPath("post-commit")
	if err != nil {
		return false
	}
	if safe, err := git.IsRepositoryScopedHookPath(path); err != nil || !safe {
		return false
	}
	data, err := os.ReadFile(path)
	return err == nil && isManagedHook(data, "post-commit")
}

func currentStateManager() (*state.Manager, error) {
	gitDir, err := git.GetGitDir()
	if err != nil {
		return nil, err
	}
	mgr := state.NewManager(gitDir)
	if err := mgr.EnsureDir(); err != nil {
		return nil, err
	}
	return mgr, nil
}

func runPush(cmd *cobra.Command, args []string) error {
	mgr, err := currentStateManager()
	if err != nil {
		return err
	}
	var pending *state.PendingPush
	pid := 0
	_, err = mgr.Update(func(s *state.State) (bool, error) {
		if s.CurrentStatus == state.StatusPushing {
			return false, errors.New("a push is already running")
		}
		if s.CurrentStatus == state.StatusPolishing {
			pid = s.PID
			s.OperationID = "" // invalidate daemon before allowing raw commit push
		}
		if s.PendingPush != nil {
			copy := *s.PendingPush
			pending = &copy
		}
		s.CurrentStatus = state.StatusPushing
		s.PID = 0
		s.StartedAt = 0
		return true, nil
	})
	if err != nil {
		return err
	}
	stopProcess(pid)

	remote := "origin"
	var refSpecs []string
	if pending != nil {
		remote = pending.Remote
		refSpecs, err = hooks.PendingRefSpecs(pending, pending.ResultSHA)
		if err != nil {
			// Old pending state cannot be reconstructed; a normal push is safer
			// than inventing a destination ref.
			refSpecs = nil
		}
	}
	if err := git.Push(remote, refSpecs); err != nil {
		_, _ = mgr.Update(func(s *state.State) (bool, error) {
			s.CurrentStatus = state.StatusFailed
			s.LastError = &state.OperationError{Code: "push_failed", Category: "push", Message: "Push failed. No workspace files were changed; retry from the terminal for interactive credentials or custom flags.", Retryable: true, OccurredAt: time.Now().Unix()}
			return true, nil
		})
		return err
	}
	_, _ = mgr.Update(func(s *state.State) (bool, error) {
		s.CurrentStatus = state.StatusIdle
		s.PendingPush = nil
		s.LastError = nil
		return true, nil
	})
	fmt.Println("Push completed.")
	return nil
}

func stopProcess(pid int) {
	if pid <= 0 {
		return
	}
	process, err := os.FindProcess(pid)
	if err == nil {
		_ = process.Kill()
	}
}
