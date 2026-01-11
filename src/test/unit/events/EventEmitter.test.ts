/**
 * Unit tests for EventEmitter
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from '../../../lib/events/EventEmitter';

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('on()', () => {
    it('should register an event handler', () => {
      const handler = vi.fn();
      emitter.on('test', handler);

      expect(emitter.listenerCount('test')).toBe(1);
    });

    it('should allow multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('test', handler1);
      emitter.on('test', handler2);

      expect(emitter.listenerCount('test')).toBe(2);
    });

    it('should not duplicate the same handler', () => {
      const handler = vi.fn();

      emitter.on('test', handler);
      emitter.on('test', handler);

      // Set prevents duplicates
      expect(emitter.listenerCount('test')).toBe(1);
    });

    it('should handle multiple different events', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('event1', handler1);
      emitter.on('event2', handler2);

      expect(emitter.listenerCount('event1')).toBe(1);
      expect(emitter.listenerCount('event2')).toBe(1);
    });
  });

  describe('off()', () => {
    it('should remove an event handler', () => {
      const handler = vi.fn();
      emitter.on('test', handler);
      emitter.off('test', handler);

      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('should only remove the specified handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('test', handler1);
      emitter.on('test', handler2);
      emitter.off('test', handler1);

      expect(emitter.listenerCount('test')).toBe(1);
    });

    it('should handle removing non-existent handler', () => {
      const handler = vi.fn();

      // Should not throw
      expect(() => emitter.off('test', handler)).not.toThrow();
    });

    it('should handle removing from non-existent event', () => {
      const handler = vi.fn();

      // Should not throw
      expect(() => emitter.off('nonexistent', handler)).not.toThrow();
    });

    it('should clean up empty event sets', () => {
      const handler = vi.fn();
      emitter.on('test', handler);
      emitter.off('test', handler);

      // Event should be removed from map when no handlers left
      expect(emitter.listenerCount('test')).toBe(0);
    });
  });

  describe('emit()', () => {
    it('should call registered handlers', () => {
      const handler = vi.fn();
      emitter.on('test', handler);

      emitter.emit('test');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to handlers', () => {
      const handler = vi.fn();
      emitter.on('test', handler);

      emitter.emit('test', 'arg1', 'arg2', 123);

      expect(handler).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('should call all handlers for an event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on('test', handler1);
      emitter.on('test', handler2);
      emitter.on('test', handler3);

      emitter.emit('test', 'data');

      expect(handler1).toHaveBeenCalledWith('data');
      expect(handler2).toHaveBeenCalledWith('data');
      expect(handler3).toHaveBeenCalledWith('data');
    });

    it('should not throw for non-existent event', () => {
      expect(() => emitter.emit('nonexistent')).not.toThrow();
    });

    it('should catch errors in handlers and continue', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      emitter.on('test', errorHandler);
      emitter.on('test', normalHandler);

      emitter.emit('test');

      // Error handler threw but normal handler should still be called
      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should pass object arguments correctly', () => {
      const handler = vi.fn();
      emitter.on('test', handler);

      const data = { key: 'value', nested: { a: 1 } };
      emitter.emit('test', data);

      expect(handler).toHaveBeenCalledWith(data);
    });
  });

  describe('once()', () => {
    it('should only call handler once', () => {
      const handler = vi.fn();
      emitter.once('test', handler);

      emitter.emit('test');
      emitter.emit('test');
      emitter.emit('test');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to once handler', () => {
      const handler = vi.fn();
      emitter.once('test', handler);

      emitter.emit('test', 'arg1', 'arg2');

      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should remove listener after first emit', () => {
      const handler = vi.fn();
      emitter.once('test', handler);

      expect(emitter.listenerCount('test')).toBe(1);

      emitter.emit('test');

      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('should work with multiple once handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.once('test', handler1);
      emitter.once('test', handler2);

      emitter.emit('test');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(emitter.listenerCount('test')).toBe(0);
    });

    it('should work alongside regular handlers', () => {
      const onceHandler = vi.fn();
      const regularHandler = vi.fn();

      emitter.once('test', onceHandler);
      emitter.on('test', regularHandler);

      emitter.emit('test');
      emitter.emit('test');

      expect(onceHandler).toHaveBeenCalledTimes(1);
      expect(regularHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('removeAllListeners()', () => {
    it('should remove all listeners for specific event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('test', handler1);
      emitter.on('test', handler2);
      emitter.on('other', vi.fn());

      emitter.removeAllListeners('test');

      expect(emitter.listenerCount('test')).toBe(0);
      expect(emitter.listenerCount('other')).toBe(1);
    });

    it('should remove all listeners for all events when no argument', () => {
      emitter.on('event1', vi.fn());
      emitter.on('event2', vi.fn());
      emitter.on('event3', vi.fn());

      emitter.removeAllListeners();

      expect(emitter.listenerCount('event1')).toBe(0);
      expect(emitter.listenerCount('event2')).toBe(0);
      expect(emitter.listenerCount('event3')).toBe(0);
    });

    it('should handle removing from non-existent event', () => {
      expect(() => emitter.removeAllListeners('nonexistent')).not.toThrow();
    });
  });

  describe('listenerCount()', () => {
    it('should return 0 for non-existent event', () => {
      expect(emitter.listenerCount('nonexistent')).toBe(0);
    });

    it('should return correct count', () => {
      emitter.on('test', vi.fn());
      emitter.on('test', vi.fn());
      emitter.on('test', vi.fn());

      expect(emitter.listenerCount('test')).toBe(3);
    });

    it('should update count after adding/removing', () => {
      const handler = vi.fn();

      expect(emitter.listenerCount('test')).toBe(0);

      emitter.on('test', handler);
      expect(emitter.listenerCount('test')).toBe(1);

      emitter.off('test', handler);
      expect(emitter.listenerCount('test')).toBe(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle rapid add/remove/emit cycles', () => {
      const handler = vi.fn();

      for (let i = 0; i < 100; i++) {
        emitter.on('test', handler);
        emitter.emit('test', i);
        emitter.off('test', handler);
      }

      expect(handler).toHaveBeenCalledTimes(100);
    });

    it('should handle complex event patterns', () => {
      const results: string[] = [];

      emitter.on('start', () => results.push('start'));
      emitter.once('initialize', () => results.push('init'));
      emitter.on('process', (data) => results.push(`process:${data}`));
      emitter.on('end', () => results.push('end'));

      emitter.emit('start');
      emitter.emit('initialize');
      emitter.emit('initialize'); // Should not call again
      emitter.emit('process', 'A');
      emitter.emit('process', 'B');
      emitter.emit('end');

      expect(results).toEqual([
        'start',
        'init',
        'process:A',
        'process:B',
        'end'
      ]);
    });
  });
});
