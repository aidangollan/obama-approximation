/**
 * WorkerPool - Manages multiple web workers for parallel processing
 */
export class WorkerPool {
  private workers: Worker[] = []
  private messageHandler: ((e: MessageEvent) => void) | null = null
  
  constructor(
    workerUrl: URL,
    numWorkers: number = navigator.hardwareConcurrency || 4
  ) {
    // Create workers
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(workerUrl)
      this.workers.push(worker)
    }
  }

  /**
   * Set message handler for all workers
   */
  onMessage(handler: (e: MessageEvent) => void) {
    this.messageHandler = handler
    this.workers.forEach(worker => {
      worker.onmessage = handler
    })
  }

  /**
   * Post message to all workers
   */
  postToAll(message: any) {
    this.workers.forEach(worker => {
      worker.postMessage(message)
    })
  }

  /**
   * Post message to specific worker
   */
  postToWorker(index: number, message: any) {
    if (index >= 0 && index < this.workers.length) {
      this.workers[index].postMessage(message)
    }
  }

  /**
   * Get number of workers
   */
  get count(): number {
    return this.workers.length
  }

  /**
   * Terminate all workers
   */
  terminate() {
    this.workers.forEach(worker => worker.terminate())
    this.workers = []
  }
}

