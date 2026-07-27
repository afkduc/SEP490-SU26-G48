const EventEmitter = require('events');

class NotificationEvents extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Emit notification event cho user qua SSE
   */
  emitNotification(userId, notification) {
    const key = String(userId);
    this.emit(`notification:${key}`, notification);
  }

  /**
   * Subscribe to notifications cho user
   */
  onNotification(userId, handler) {
    const key = String(userId);
    const listener = (notification) => handler(notification);
    this.on(`notification:${key}`, listener);
    return () => {
      this.off(`notification:${key}`, listener);
    };
  }

  /**
   * Remove all listeners cho user
   */
  removeAllListenersForUser(userId) {
    this.removeAllListeners(`notification:${String(userId)}`);
  }
}

// Singleton instance
const notificationEvents = new NotificationEvents();

module.exports = notificationEvents;
module.exports.NotificationEvents = NotificationEvents;
