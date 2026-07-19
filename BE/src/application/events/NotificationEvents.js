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
    this.emit(`notification:${userId}`, notification);
  }

  /**
   * Subscribe to notifications cho user
   */
  onNotification(userId, handler) {
    const listener = (notification) => handler(notification);
    this.on(`notification:${userId}`, listener);
    return () => {
      this.off(`notification:${userId}`, listener);
    };
  }

  /**
   * Remove all listeners cho user
   */
  removeAllListenersForUser(userId) {
    this.removeAllListeners(`notification:${userId}`);
  }
}

// Singleton instance
const notificationEvents = new NotificationEvents();

module.exports = notificationEvents;
module.exports.NotificationEvents = NotificationEvents;
