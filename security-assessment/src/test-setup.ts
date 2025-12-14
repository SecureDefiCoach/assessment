/**
 * Test setup configuration for Jest
 */

// Increase timeout for container operations
jest.setTimeout(30000);

// Mock Docker if not available in test environment
if (process.env.NODE_ENV === 'test' && !process.env.DOCKER_AVAILABLE) {
  jest.mock('dockerode', () => {
    return jest.fn().mockImplementation(() => ({
      createContainer: jest.fn(),
      listContainers: jest.fn(),
    }));
  });
}