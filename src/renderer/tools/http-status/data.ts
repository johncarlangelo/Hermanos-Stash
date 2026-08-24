/**
 * The complete set of HTTP status codes (1xx–5xx, 63 codes) with
 * short plain-language meanings.
 */

export type StatusClass = 1 | 2 | 3 | 4 | 5

export interface HttpStatusEntry {
  code: number
  name: string
  meaning: string
}

export const CLASS_LABELS: Record<StatusClass, string> = {
  1: 'Informational',
  2: 'Success',
  3: 'Redirection',
  4: 'Client Error',
  5: 'Server Error'
}

export const HTTP_STATUSES: HttpStatusEntry[] = [
  // 1xx Informational (4)
  { code: 100, name: 'Continue', meaning: 'Client should continue with the request body.' },
  {
    code: 101,
    name: 'Switching Protocols',
    meaning: 'Server agrees to switch protocols, e.g. to WebSocket.'
  },
  { code: 102, name: 'Processing', meaning: 'Server received the request and is still working.' },
  {
    code: 103,
    name: 'Early Hints',
    meaning: 'Preliminary response headers the client can preload while it waits.'
  },

  // 2xx Success (10)
  { code: 200, name: 'OK', meaning: 'The request succeeded.' },
  {
    code: 201,
    name: 'Created',
    meaning: 'A new resource was created as a result of the request.'
  },
  { code: 202, name: 'Accepted', meaning: 'Request accepted but not finished processing yet.' },
  {
    code: 203,
    name: 'Non-Authoritative Information',
    meaning: 'Response came from a copy or cache, not the origin server.'
  },
  { code: 204, name: 'No Content', meaning: 'Success with nothing to return in the body.' },
  {
    code: 205,
    name: 'Reset Content',
    meaning: 'Success — the client should reset the document view or form.'
  },
  {
    code: 206,
    name: 'Partial Content',
    meaning: 'Only part of the resource is returned, per range.'
  },
  {
    code: 207,
    name: 'Multi-Status',
    meaning: 'Multiple independent operations reported individually (WebDAV).'
  },
  {
    code: 208,
    name: 'Already Reported',
    meaning: 'Member already listed earlier in this multi-status response (WebDAV).'
  },
  { code: 226, name: 'IM Used', meaning: 'Response is a delta applied to an earlier instance.' },

  // 3xx Redirection (9)
  {
    code: 300,
    name: 'Multiple Choices',
    meaning: 'Several representations exist; the client must pick one.'
  },
  {
    code: 301,
    name: 'Moved Permanently',
    meaning: 'The resource has permanently moved to a new URL.'
  },
  { code: 302, name: 'Found', meaning: 'The resource temporarily lives at another URL.' },
  {
    code: 303,
    name: 'See Other',
    meaning: 'Fetch the result from a different URL using GET.'
  },
  {
    code: 304,
    name: 'Not Modified',
    meaning: 'Cached version is still fresh — no body needed.'
  },
  {
    code: 305,
    name: 'Use Proxy',
    meaning: 'Deprecated — the resource must be reached through a proxy.'
  },
  { code: 306, name: '(Unused)', meaning: 'Reserved code that is no longer used.' },
  {
    code: 307,
    name: 'Temporary Redirect',
    meaning: 'Temporarily at another URL; keep the same method.'
  },
  {
    code: 308,
    name: 'Permanent Redirect',
    meaning: 'Permanently moved; keep the same method going forward.'
  },

  // 4xx Client Error (29)
  {
    code: 400,
    name: 'Bad Request',
    meaning: 'The server cannot process the malformed request.'
  },
  {
    code: 401,
    name: 'Unauthorized',
    meaning: 'Authentication is required and was missing or invalid.'
  },
  {
    code: 402,
    name: 'Payment Required',
    meaning: 'Reserved for payment — rarely used in practice.'
  },
  {
    code: 403,
    name: 'Forbidden',
    meaning: 'Authenticated but not allowed to access this resource.'
  },
  { code: 404, name: 'Not Found', meaning: 'No resource exists at this address.' },
  {
    code: 405,
    name: 'Method Not Allowed',
    meaning: 'This HTTP method is not supported for the resource.'
  },
  {
    code: 406,
    name: 'Not Acceptable',
    meaning: 'No representation matches what the client asked to accept.'
  },
  {
    code: 407,
    name: 'Proxy Authentication Required',
    meaning: 'The proxy needs credentials before forwarding.'
  },
  {
    code: 408,
    name: 'Request Timeout',
    meaning: 'The client took too long to send the request.'
  },
  {
    code: 409,
    name: 'Conflict',
    meaning: 'The request clashes with the current state of the resource.'
  },
  { code: 410, name: 'Gone', meaning: 'The resource existed but is permanently removed.' },
  {
    code: 411,
    name: 'Length Required',
    meaning: 'A Content-Length header is required and was missing.'
  },
  {
    code: 412,
    name: 'Precondition Failed',
    meaning: 'A request precondition, like If-Match, did not hold.'
  },
  {
    code: 413,
    name: 'Content Too Large',
    meaning: 'The request body exceeds what the server will accept.'
  },
  {
    code: 414,
    name: 'URI Too Long',
    meaning: 'The requested URL is longer than the server can handle.'
  },
  {
    code: 415,
    name: 'Unsupported Media Type',
    meaning: 'The payload format is not supported by the resource.'
  },
  {
    code: 416,
    name: 'Range Not Satisfiable',
    meaning: 'The requested byte range falls outside the resource size.'
  },
  {
    code: 417,
    name: 'Expectation Failed',
    meaning: 'An Expect header requirement could not be met.'
  },
  {
    code: 418,
    name: "I'm a Teapot",
    meaning: 'A joke status from RFC 2324 — short and stout, refuses to brew coffee.'
  },
  {
    code: 421,
    name: 'Misdirected Request',
    meaning: 'The request went to a server that cannot produce a response.'
  },
  {
    code: 422,
    name: 'Unprocessable Content',
    meaning: 'Well-formed request with semantic errors in its content.'
  },
  { code: 423, name: 'Locked', meaning: 'The resource is locked by another operation (WebDAV).' },
  {
    code: 424,
    name: 'Failed Dependency',
    meaning: 'A prerequisite request failed, so this one did too (WebDAV).'
  },
  {
    code: 425,
    name: 'Too Early',
    meaning: 'The server will not risk replaying a request sent too soon.'
  },
  {
    code: 426,
    name: 'Upgrade Required',
    meaning: 'The client must switch to a different protocol first.'
  },
  {
    code: 428,
    name: 'Precondition Required',
    meaning: 'The server demands conditional headers to prevent lost updates.'
  },
  {
    code: 429,
    name: 'Too Many Requests',
    meaning: 'Rate limit hit — slow down before trying again.'
  },
  {
    code: 431,
    name: 'Request Header Fields Too Large',
    meaning: 'Headers are too big for the server to process.'
  },
  {
    code: 451,
    name: 'Unavailable For Legal Reasons',
    meaning: 'Access denied because of a legal demand.'
  },

  // 5xx Server Error (11)
  {
    code: 500,
    name: 'Internal Server Error',
    meaning: 'The server hit an unexpected condition and failed.'
  },
  {
    code: 501,
    name: 'Not Implemented',
    meaning: 'The server does not support the functionality required.'
  },
  {
    code: 502,
    name: 'Bad Gateway',
    meaning: 'An upstream server returned an invalid response.'
  },
  {
    code: 503,
    name: 'Service Unavailable',
    meaning: 'The server is overloaded or down for maintenance.'
  },
  {
    code: 504,
    name: 'Gateway Timeout',
    meaning: 'An upstream server took too long to answer.'
  },
  {
    code: 505,
    name: 'HTTP Version Not Supported',
    meaning: 'The server does not support the HTTP version used.'
  },
  {
    code: 506,
    name: 'Variant Also Negotiates',
    meaning: 'Transparent content negotiation is misconfigured.'
  },
  { code: 507, name: 'Insufficient Storage', meaning: 'The server is out of space (WebDAV).' },
  {
    code: 508,
    name: 'Loop Detected',
    meaning: 'Infinite loop detected while processing (WebDAV).'
  },
  {
    code: 510,
    name: 'Not Extended',
    meaning: 'Further extensions to the request are required.'
  },
  {
    code: 511,
    name: 'Network Authentication Required',
    meaning: 'Network access needs login first, e.g. captive portal.'
  }
]
