# Test Coverage Analysis - LearnKids AI

## Executive Summary

**Current State: ZERO automated test coverage**

The LearnKids AI codebase (~1,600 lines of source code) has no automated tests. All quality assurance relies on manual testing documented in `docs/TESTING.md`. While acceptable for an early MVP, automated testing is critical before adding more features or courses.

---

## 1. Project Overview

| Metric | Value |
|--------|-------|
| Source code lines | ~1,600 |
| Test files | 0 |
| Test coverage | 0% |
| Test frameworks installed | None |
| Current version | 2.6.0 |

**Technology Stack:**
- Backend: Node.js 20+ with MCP SDK
- Frontend: React 19 + TypeScript + Vite
- Transport: Server-Sent Events (SSE)
- Deployment: Google Cloud Run

---

## 2. Critical Areas Requiring Tests

### Priority 1: Security Functions (HIGH RISK)

#### `isValidCourseId()` - Path Traversal Prevention
**File:** `server.js:98-104` and `mcp-server/index.js:83-92`

```javascript
function isValidCourseId(courseId) {
  if (!coursesData) return false;
  if (courseId.includes('..') || courseId.includes('/') || courseId.includes('\\')) {
    return false;
  }
  return coursesData.courses.some(course => course.id === courseId);
}
```

**Tests needed:**
- Valid course IDs pass (e.g., `python-kids`)
- Path traversal attempts blocked (`../etc/passwd`, `foo/../bar`)
- URL-encoded traversal blocked (`%2e%2e%2f`)
- Null bytes blocked (`foo\0bar`)
- Empty string handling
- Non-existent course IDs rejected

#### Student Code Validation
**File:** `server.js:531-644`

**Tests needed:**
- Empty code submission handling
- Very long code submissions (5000+ chars)
- Code with special characters
- Code with malicious patterns (script injection attempts)
- Regex pattern validation edge cases

---

### Priority 2: MCP Tool Handlers (MEDIUM-HIGH RISK)

#### `get-courses` Tool
**File:** `server.js:396-425`

**Tests needed:**
- Returns correct course structure
- Handles missing courses.json gracefully
- Returns proper MCP response format

#### `view-course-details` Tool
**File:** `server.js:427-470`

**Tests needed:**
- Valid course ID returns full details
- Invalid course ID returns error
- Malformed courseId parameter handling

#### `start-lesson` Tool
**File:** `server.js:472-528`

**Tests needed:**
- Valid courseId + lessonNumber loads lesson
- Lesson number out of bounds (0, -1, 999)
- Invalid lesson format handling
- Lesson data structure validation

#### `check-student-work` Tool
**File:** `server.js:530-645`

**Tests needed:**
- Correct code passes validation
- Incorrect code fails with helpful message
- Regex validation edge cases
- Fallback behavior when no validation pattern exists
- Error handling for malformed regex patterns

---

### Priority 3: Data Loading & Caching (MEDIUM RISK)

#### `loadCourses()` Function
**Files:** `server.js:65-78`, `mcp-server/index.js:34-45`

**Tests needed:**
- Successfully loads and parses courses.json
- Caching works (second call doesn't re-read file)
- Handles missing file gracefully
- Handles malformed JSON
- Handles empty courses array

#### `loadLessons()` Function
**Files:** `server.js:80-96`, `mcp-server/index.js:52-72`

**Tests needed:**
- Successfully loads lessons for valid course
- Caching works correctly
- Handles missing lesson file
- Handles malformed lesson JSON

---

### Priority 4: HTTP Server & SSE (MEDIUM RISK)

#### SSE Connection Handler
**File:** `server.js:679-716`

**Tests needed:**
- SSE connection establishes correctly
- Session stored in sessions Map
- Connection cleanup on close
- Timeout cleanup after 1 hour

#### POST Message Handler
**File:** `server.js:718-785`

**Tests needed:**
- Valid sessionId finds session
- Temp session promotion works
- Invalid sessionId returns 404
- JSON parsing errors handled
- Message forwarding works

#### Static File Serving
**File:** `server.js:160-194`

**Tests needed:**
- Serves valid files correctly
- Path traversal blocked
- 404 for missing files
- Correct MIME types
- CORS headers present

---

### Priority 5: React Components & Hooks (MEDIUM RISK)

#### `useWidgetState` Hook
**File:** `widget-src/hooks/useWidgetState.ts`

**Tests needed:**
- Initial state from defaultState
- State from window.openai.widgetState
- State updates propagate to window.openai
- Function updater works correctly

#### `useOpenAiGlobal` Hook
**File:** `widget-src/hooks/useOpenAiGlobal.ts`

**Tests needed:**
- Returns value from window.openai
- Handles missing window.openai
- Re-renders on value change

#### `callTool` Function
**File:** `widget-src/App.tsx:70-108`

**Tests needed:**
- Successful tool call returns structuredContent
- Fallback to content[0].text parsing
- Error handling for missing window.openai
- Error handling for failed tool calls

#### App Component
**File:** `widget-src/App.tsx:357-510`

**Tests needed:**
- Renders loading state initially
- Transitions to catalog on courses load
- Handles tool output with pre-loaded data
- Error state renders correctly
- Course selection triggers lesson load
- Lesson completion updates progress

---

## 3. Recommended Testing Stack

### Unit Tests: Vitest
Vitest is recommended over Jest for this project because:
- Native ESM support (project uses `"type": "module"`)
- Built-in TypeScript support
- Faster execution
- Compatible with Vite build system

```bash
npm install -D vitest @vitest/coverage-v8
```

### React Component Tests: Testing Library
```bash
npm install -D @testing-library/react @testing-library/jest-dom jsdom
```

### E2E Tests: Playwright
```bash
npm install -D @playwright/test
```

---

## 4. Proposed Test Structure

```
learningkids-ai/
├── tests/
│   ├── unit/
│   │   ├── server/
│   │   │   ├── isValidCourseId.test.ts
│   │   │   ├── loadCourses.test.ts
│   │   │   ├── loadLessons.test.ts
│   │   │   ├── validateAnswer.test.ts
│   │   │   └── tools/
│   │   │       ├── getCourses.test.ts
│   │   │       ├── viewCourseDetails.test.ts
│   │   │       ├── startLesson.test.ts
│   │   │       └── checkStudentWork.test.ts
│   │   └── hooks/
│   │       ├── useWidgetState.test.tsx
│   │       ├── useOpenAiGlobal.test.tsx
│   │       └── useWidgetProps.test.tsx
│   ├── integration/
│   │   ├── mcp-flow.test.ts
│   │   ├── sse-connection.test.ts
│   │   └── session-management.test.ts
│   └── e2e/
│       ├── browse-courses.spec.ts
│       ├── complete-lesson.spec.ts
│       └── progress-persistence.spec.ts
├── vitest.config.ts
└── playwright.config.ts
```

---

## 5. Sample Test Implementations

### Example 1: Security Test for Path Traversal

```typescript
// tests/unit/server/isValidCourseId.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

// Mock coursesData
const mockCoursesData = {
  courses: [
    { id: 'python-kids' },
    { id: 'scratch-basics' }
  ]
};

describe('isValidCourseId', () => {
  describe('path traversal prevention', () => {
    it('rejects ".." sequences', () => {
      expect(isValidCourseId('../etc/passwd')).toBe(false);
      expect(isValidCourseId('python-kids/../admin')).toBe(false);
      expect(isValidCourseId('..\\windows\\system32')).toBe(false);
    });

    it('rejects forward slashes', () => {
      expect(isValidCourseId('path/to/file')).toBe(false);
      expect(isValidCourseId('/etc/passwd')).toBe(false);
    });

    it('rejects backslashes', () => {
      expect(isValidCourseId('path\\to\\file')).toBe(false);
      expect(isValidCourseId('C:\\Windows')).toBe(false);
    });

    it('rejects URL-encoded traversal', () => {
      // Note: Need to ensure URL decoding happens before validation
      expect(isValidCourseId('%2e%2e%2f')).toBe(false);
    });
  });

  describe('valid course IDs', () => {
    it('accepts valid course IDs', () => {
      expect(isValidCourseId('python-kids')).toBe(true);
      expect(isValidCourseId('scratch-basics')).toBe(true);
    });

    it('rejects non-existent course IDs', () => {
      expect(isValidCourseId('nonexistent-course')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isValidCourseId('')).toBe(false);
    });
  });
});
```

### Example 2: MCP Tool Handler Test

```typescript
// tests/unit/server/tools/checkStudentWork.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('check-student-work tool', () => {
  describe('validation logic', () => {
    it('validates correct print statement', async () => {
      const result = await checkStudentWork({
        courseId: 'python-kids',
        lessonNumber: 1,
        studentCode: 'print("Hello World")'
      });

      expect(result.structuredContent.validation.correct).toBe(true);
      expect(result.structuredContent.validation.reward).toBeDefined();
    });

    it('rejects empty code submission', async () => {
      const result = await checkStudentWork({
        courseId: 'python-kids',
        lessonNumber: 1,
        studentCode: ''
      });

      expect(result.structuredContent.validation.correct).toBe(false);
      expect(result.structuredContent.validation.hasAttempt).toBe(false);
    });

    it('handles regex validation errors gracefully', async () => {
      // Mock lesson with invalid regex pattern
      const result = await checkStudentWork({
        courseId: 'python-kids',
        lessonNumber: 1,
        studentCode: 'some code'
      });

      // Should not throw, should return a result
      expect(result.isError).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('returns error for invalid courseId', async () => {
      const result = await checkStudentWork({
        courseId: '../etc/passwd',
        lessonNumber: 1,
        studentCode: 'test'
      });

      expect(result.isError).toBe(true);
    });

    it('returns error for non-existent lesson', async () => {
      const result = await checkStudentWork({
        courseId: 'python-kids',
        lessonNumber: 999,
        studentCode: 'test'
      });

      expect(result.isError).toBe(true);
    });
  });
});
```

### Example 3: React Hook Test

```typescript
// tests/unit/hooks/useWidgetState.test.tsx
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWidgetState } from '../../../widget-src/hooks/useWidgetState';

describe('useWidgetState', () => {
  beforeEach(() => {
    // Reset window.openai mock
    (window as any).openai = undefined;
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() =>
      useWidgetState({ count: 0 })
    );

    expect(result.current[0]).toEqual({ count: 0 });
  });

  it('uses widgetState from window.openai if available', () => {
    (window as any).openai = {
      widgetState: { count: 42 }
    };

    const { result } = renderHook(() =>
      useWidgetState({ count: 0 })
    );

    expect(result.current[0]).toEqual({ count: 42 });
  });

  it('calls window.openai.setWidgetState on update', () => {
    const mockSetWidgetState = vi.fn();
    (window as any).openai = {
      setWidgetState: mockSetWidgetState
    };

    const { result } = renderHook(() =>
      useWidgetState({ count: 0 })
    );

    act(() => {
      result.current[1]({ count: 1 });
    });

    expect(mockSetWidgetState).toHaveBeenCalledWith({ count: 1 });
  });
});
```

### Example 4: E2E Test with Playwright

```typescript
// tests/e2e/complete-lesson.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Lesson Completion Flow', () => {
  test('user can complete a lesson and earn stars', async ({ page }) => {
    await page.goto('http://localhost:8000/');

    // Select a course
    await page.click('text=Python for Kids');

    // Wait for lesson to load
    await expect(page.locator('.lesson-title')).toBeVisible();

    // Fill in the code exercise
    await page.fill('.code-editor', 'print("Hello World")');

    // Submit answer
    await page.click('text=Check My Answer');

    // Verify success
    await expect(page.locator('.result-box.success')).toBeVisible();
    await expect(page.locator('.reward-stars')).toContainText('⭐');
  });

  test('incorrect answer shows helpful feedback', async ({ page }) => {
    await page.goto('http://localhost:8000/');
    await page.click('text=Python for Kids');

    await page.fill('.code-editor', 'wrong answer');
    await page.click('text=Check My Answer');

    await expect(page.locator('.result-box.error')).toBeVisible();
    await expect(page.locator('.result-message')).not.toBeEmpty();
  });
});
```

---

## 6. Prioritized Implementation Roadmap

### Phase 1: Critical Security Tests (Week 1)
1. Set up Vitest testing framework
2. Write tests for `isValidCourseId()` - path traversal prevention
3. Write tests for student code validation
4. Add pre-commit hook to run tests

### Phase 2: Core Tool Tests (Week 2)
1. Write tests for all 4 MCP tools
2. Write tests for data loading functions
3. Test error handling paths

### Phase 3: React Component Tests (Week 3)
1. Set up Testing Library
2. Write tests for custom hooks
3. Write tests for key components (App, LessonViewer)

### Phase 4: Integration & E2E Tests (Week 4)
1. Set up Playwright
2. Write SSE connection tests
3. Write full user journey E2E tests

---

## 7. Metrics & Goals

| Metric | Current | Target (Phase 1) | Target (Final) |
|--------|---------|------------------|----------------|
| Unit test coverage | 0% | 30% | 70% |
| Security function coverage | 0% | 100% | 100% |
| Tool handler coverage | 0% | 80% | 95% |
| React hook coverage | 0% | 0% | 80% |
| E2E test scenarios | 0 | 0 | 10+ |

---

## 8. Configuration Files Needed

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '*.config.*'],
    },
  },
});
```

### package.json additions
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

---

## 9. Immediate Action Items

1. **Install testing dependencies:**
   ```bash
   npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
   ```

2. **Create vitest.config.ts** with proper ESM and React support

3. **Write first security test** for `isValidCourseId()`

4. **Add test script** to package.json

5. **Set up pre-commit hook** to run tests before commits

---

## Conclusion

The LearnKids AI codebase is production-deployed with zero automated test coverage. While the manual testing documentation is comprehensive, automated tests are essential for:

- **Security assurance** - Validate path traversal and input sanitization
- **Regression prevention** - Catch bugs when adding new features/courses
- **Confidence in deployments** - Know changes won't break existing functionality
- **Documentation** - Tests serve as executable specifications

The recommended approach is to start with security-critical functions, then expand to tool handlers, and finally add integration and E2E tests.
