/***
 Here we create a CallbackQueueManager class object
 This allows to store callbacks in a queue array with a timeout of 0 to be executed on next render call

 returns:
 @this: our CallbackQueueManager class object
 ***/
export class CallbackQueueManager {
    constructor() {
        this.clear();
    }

    /***
     Clears our queue array (used on init)
     ***/
    clear() {
        this.queue = [];
    }

    /***
     Adds a callback to our queue list with a timeout of 0

     params:
     @callback (function): the callback to execute on next render call
     @keep (bool): whether to keep calling that callback on each rendering call or not (act as a setInterval). Default to false

     returns:
     @queueItem: the queue item. Allows to keep a track of it and set its keep property to false when needed
     ***/
    add(callback, keep = false) {
        const queueItem = {
            callback,
            keep,
            timeout: null, // keep a reference to the timeout so we can safely delete if afterwards
        };
        queueItem.timeout = setTimeout(() => {
            this.queue.push(queueItem);
        }, 0);

        return queueItem;
    }

    /***
     Executes all callbacks in the queue and remove the ones that have their keep property set to false.
     Called at the beginning of each render call
     ***/
    execute() {
        // execute queue callbacks list
        this.queue.map((entry) => {
            if(entry.callback) {
                entry.callback();
            }

            // clear our timeout
            clearTimeout(this.queue.timeout);
        });

        // remove all items that have their keep property set to false
        this.queue = this.queue.filter((entry) => entry.keep);
    }
}