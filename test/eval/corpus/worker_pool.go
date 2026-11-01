package pool

import (
	"context"
	"errors"
	"sync"
)

// Job is a unit of work. Run must respect ctx cancellation.
type Job interface {
	Run(ctx context.Context) error
}

// Result pairs a job's index with its error, if any.
type Result struct {
	Index int
	Err   error
}

var ErrNoWorkers = errors.New("pool: workers must be positive")

// Run executes jobs with at most `workers` running at once and returns
// results in input order. The first error cancels the remaining jobs.
func Run(ctx context.Context, workers int, jobs []Job) ([]Result, error) {
	if workers <= 0 {
		return nil, ErrNoWorkers
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	results := make([]Result, len(jobs))
	indexes := make(chan int)
	var wg sync.WaitGroup
	var once sync.Once
	var firstErr error

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range indexes {
				err := jobs[i].Run(ctx)
				results[i] = Result{Index: i, Err: err}
				if err != nil {
					once.Do(func() {
						firstErr = err
						cancel()
					})
				}
			}
		}()
	}

feed:
	for i := range jobs {
		select {
		case indexes <- i:
		case <-ctx.Done():
			break feed
		}
	}
	close(indexes)
	wg.Wait()
	return results, firstErr
}
