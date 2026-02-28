/**
 * 事件 API 测试
 */
const request = require('supertest');
const app = require('../../app');

describe('Events API', () => {
  describe('POST /api/sensors/track', () => {
    it('应该成功创建事件', async () => {
      const eventData = {
        event_type: 'track',
        event_name: 'test_event',
        distinct_id: 'test_user_123',
        properties: {
          test_property: 'test_value'
        },
        timestamp: Date.now()
      };

      const response = await request(app)
        .post('/api/sensors/track')
        .send(eventData)
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('event_id');
    });

    it('应该验证必需参数', async () => {
      const response = await request(app)
        .post('/api/sensors/track')
        .send({})
        .expect(400);

      expect(response.body.code).toBe(400);
      expect(response.body.message).toContain('验证失败');
    });

    it('应该处理无效的 JSON 数据', async () => {
      const response = await request(app)
        .post('/api/sensors/track')
        .send('invalid json')
        .expect(400);

      expect(response.body.code).toBe(400);
    });
  });

  describe('GET /api/analytics/events/stats', () => {
    beforeEach(async () => {
      // 创建测试事件数据
      const { Event } = require('../../models');
      
      await global.testUtils.createTestData(Event, {
        event_id: 'test_event_1',
        app_id: 'test_app',
        event_type: 'track',
        event_name: 'test_event',
        distinct_id: 'test_user_1',
        properties: { test: 'value' },
        timestamp: Date.now(),
        created_at: new Date()
      });

      await global.testUtils.createTestData(Event, {
        event_id: 'test_event_2',
        app_id: 'test_app',
        event_type: 'track',
        event_name: 'test_event',
        distinct_id: 'test_user_2',
        properties: { test: 'value' },
        timestamp: Date.now(),
        created_at: new Date()
      });
    });

    it('应该返回事件统计', async () => {
      const response = await request(app)
        .get('/api/analytics/events/stats')
        .query({ appId: 'test_app' })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('totalEvents');
      expect(response.body.data.totalEvents).toBeGreaterThan(0);
    });

    it('应该支持时间范围过滤', async () => {
      const response = await request(app)
        .get('/api/analytics/events/stats')
        .query({ 
          appId: 'test_app',
          timeRange: '24h'
        })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('totalEvents');
    });
  });

  describe('GET /api/analytics/events/list', () => {
    beforeEach(async () => {
      // 创建测试事件数据
      const { Event } = require('../../models');
      
      for (let i = 0; i < 5; i++) {
        await global.testUtils.createTestData(Event, {
          event_id: `test_event_${i}`,
          app_id: 'test_app',
          event_type: 'track',
          event_name: 'test_event',
          distinct_id: `test_user_${i}`,
          properties: { test: 'value' },
          timestamp: Date.now(),
          created_at: new Date()
        });
      }
    });

    it('应该返回事件列表', async () => {
      const response = await request(app)
        .get('/api/analytics/events/list')
        .query({ appId: 'test_app' })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('list');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.list)).toBe(true);
    });

    it('应该支持分页', async () => {
      const response = await request(app)
        .get('/api/analytics/events/list')
        .query({ 
          appId: 'test_app',
          page: 1,
          pageSize: 2
        })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data.list.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.pageSize).toBe(2);
    });

    it('应该支持事件名称过滤', async () => {
      const response = await request(app)
        .get('/api/analytics/events/list')
        .query({ 
          appId: 'test_app',
          eventName: 'test_event'
        })
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data.list.length).toBeGreaterThan(0);
    });
  });
});
