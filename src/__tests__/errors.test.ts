import { WebDAVError } from '../errors';

describe('WebDAVError', () => {
  it('should create error with message', () => {
    const error = new WebDAVError('Test error');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WebDAVError);
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('WebDAVError');
    expect(error.status).toBeUndefined();
  });

  it('should create error with message and status', () => {
    const error = new WebDAVError('Not Found', 404);
    expect(error.message).toBe('Not Found');
    expect(error.status).toBe(404);
  });

  it('should create error with message, status and cause', () => {
    const cause = new Error('Original error');
    const error = new WebDAVError('Failed request', 500, cause);
    expect(error.message).toBe('Failed request');
    expect(error.status).toBe(500);
    expect(error.cause).toBe(cause);
  });

  it('should format error message with status code', () => {
    const error = new WebDAVError('Not Found', 404);
    expect(error.toString()).toBe('WebDAVError: Not Found (Status: 404)');
  });

  it('should format error message without status code', () => {
    const error = new WebDAVError('Network error');
    expect(error.toString()).toBe('WebDAVError: Network error');
  });

  it('should create error from HTTP response', () => {
    const response = {
      status: 403,
      statusText: 'Forbidden',
    } as Response;

    const error = WebDAVError.fromResponse(response);
    expect(error.message).toBe('403 Forbidden');
    expect(error.status).toBe(403);
  });

  it('should create error from HTTP response with custom message', () => {
    const response = {
      status: 403,
      statusText: 'Forbidden',
    } as Response;

    const error = WebDAVError.fromResponse(response, 'Access denied');
    expect(error.message).toBe('Access denied: 403 Forbidden');
    expect(error.status).toBe(403);
  });

  it('should create error from network error', () => {
    const originalError = new Error('Network failure');
    const error = WebDAVError.fromError(originalError);
    expect(error).toBeInstanceOf(WebDAVError);
    expect(error.message).toBe('Network failure');
    expect(error.cause).toBe(originalError);
  });

  it('should pass through WebDAVError instances', () => {
    const originalError = new WebDAVError('Original WebDAV error', 404);
    const error = WebDAVError.fromError(originalError);
    expect(error).toBe(originalError); // Should be the same instance
  });

  it('should create error with default message if original error has no message', () => {
    const originalError = new Error();
    originalError.message = ''; // Empty message
    const error = WebDAVError.fromError(originalError);
    expect(error.message).toBe('Unknown WebDAV error');
  });

  it('should handle non-Error objects', () => {
    const error = WebDAVError.fromError('Just a string' as any);
    expect(error.message).toBe('Unknown WebDAV error');
  });
});