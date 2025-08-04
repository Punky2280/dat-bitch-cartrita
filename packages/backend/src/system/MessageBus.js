import { EventEmitter } from 'events';

class MessageBus extends EventEmitter {
    constructor() {
        super();
        this.subscribers = new Map();
        console.log('✅ Enhanced MessageBus with MCP initialized');
    }

    subscribe(event, callback) {
        this.on(event, callback);
        
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, []);
        }
        this.subscribers.get(event).push(callback);
        
        return () => this.unsubscribe(event, callback);
    }

    publish(event, data) {
        this.emit(event, data);
    }

    unsubscribe(event, callback) {
        this.off(event, callback);
        
        if (this.subscribers.has(event)) {
            const callbacks = this.subscribers.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    getSubscriberCount(event) {
        return this.subscribers.has(event) ? this.subscribers.get(event).length : 0;
    }

    getAllEvents() {
        return Array.from(this.subscribers.keys());
    }
}

// Create singleton instance
const messageBus = new MessageBus();
export default messageBus;
