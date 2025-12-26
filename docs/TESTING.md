# 🧪 Testing Guide

Comprehensive testing strategy and checklist for LearnKids AI.

## Testing Philosophy

For an MVP educational app targeting children, we prioritize:
1. **Manual testing** over automated (appropriate for MVP)
2. **User experience** over code coverage
3. **Happy path** validation over edge cases
4. **Real user testing** with target age group

---

## Test Environments

### 1. Local Development
- MCP server running on localhost
- Web component opened in browser
- Mock `window.openai` API

### 2. Staging (ngrok)
- MCP server exposed via ngrok
- Connected to ChatGPT Developer Mode
- Full integration testing

### 3. Production
- Deployed to Railway/Render
- Connected to ChatGPT
- End-user testing

---

## Unit Testing (Tools/Functions)

### MCP Server Tools

Use MCP Inspector for manual tool testing:

```bash
npx @modelcontextprotocol/inspector node mcp-server/index.js
```

#### Test: getCourses()

**Input:**
```json
{}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "courses": [
      {
        "id": "python-kids",
        "title": "Python for Kids",
        "emoji": "🐍",
        "totalLessons": 5
      }
    ]
  }
}
```

**Validation:**
- [ ] Returns success: true
- [ ] Contains course array
- [ ] Each course has required fields (id, title, emoji)
- [ ] Response time < 500ms

#### Test: getLesson()

**Input:**
```json
{
  "courseId": "python-kids",
  "lessonId": "lesson-1"
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "lesson": {
      "id": "lesson-1",
      "title": "Magic Variables 🪄",
      "content": { ... },
      "exercise": { ... }
    }
  }
}
```

**Validation:**
- [ ] Returns correct lesson
- [ ] Contains all required fields
- [ ] Character emoji present
- [ ] Exercise has template and validation
- [ ] Response time < 500ms

#### Test: checkAnswer() - Correct

**Input:**
```json
{
  "courseId": "python-kids",
  "lessonId": "lesson-1",
  "answer": "favorite_animal = \"cat\"\nprint(favorite_animal)"
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "correct": true,
    "message": "🎉 Amazing! ...",
    "reward": {
      "stars": 1,
      "badge": "First Variable"
    },
    "nextLesson": "lesson-2"
  }
}
```

**Validation:**
- [ ] correct: true
- [ ] Has encouraging message
- [ ] Includes reward info
- [ ] Suggests next lesson

#### Test: checkAnswer() - Incorrect

**Input:**
```json
{
  "courseId": "python-kids",
  "lessonId": "lesson-1",
  "answer": "wrong code"
}
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "correct": false,
    "message": "Not quite right...",
    "hint": "Remember to use quotes..."
  }
}
```

**Validation:**
- [ ] correct: false
- [ ] Message is encouraging (not discouraging)
- [ ] Provides helpful hint

#### Test: Error Cases

**Invalid Course ID:**
```json
{
  "courseId": "../../../etc/passwd",
  "lessonId": "lesson-1"
}
```

**Expected:** Error with COURSE_NOT_FOUND

**Invalid Lesson ID:**
```json
{
  "courseId": "python-kids",
  "lessonId": "lesson-999"
}
```

**Expected:** Error with LESSON_NOT_FOUND

---

## Integration Testing (Full Flow)

### Test 1: Complete User Journey

**Scenario:** Child completes first lesson

**Steps:**
1. Open app in ChatGPT
2. See course catalog
3. Click "Python for Kids"
4. See Lesson 1 load
5. Read explanation
6. View examples
7. Write code in editor
8. Click "Check Answer"
9. See success message
10. Earn star and badge
11. Auto-advance to Lesson 2

**Expected:**
- [ ] Each step loads quickly (< 2s)
- [ ] UI is responsive
- [ ] Progress saves to widget state
- [ ] Can continue from same spot later

### Test 2: Progress Persistence

**Scenario:** User returns to app

**Steps:**
1. Complete Lesson 1
2. Close widget (go back to main chat)
3. Reopen app using widget controls
4. Check progress is retained

**Expected:**
- [ ] completedLessons includes lesson-1
- [ ] earnedStars reflects completion
- [ ] Can continue to Lesson 2

### Test 3: Hint System

**Scenario:** Student needs help

**Steps:**
1. Start Lesson 1
2. Click "Need a Hint?"
3. Read hint
4. Use hint to complete exercise

**Expected:**
- [ ] Hint appears clearly
- [ ] Hint is actually helpful
- [ ] Can still check answer after viewing hint

### Test 4: Error Recovery

**Scenario:** Network error during lesson load

**Steps:**
1. Start loading lesson
2. Disconnect network
3. See error message
4. Reconnect network
5. Click "Try Again"

**Expected:**
- [ ] Error message is friendly
- [ ] Retry button works
- [ ] Lesson loads successfully after retry

---

## UI/UX Testing

### Visual Design Checklist

**Course Catalog:**
- [ ] Cards are colorful and appealing
- [ ] Emojis are large and visible
- [ ] Text is readable (not too small)
- [ ] Hover effects work
- [ ] Responsive on mobile

**Lesson View:**
- [ ] Character emoji is prominent
- [ ] Greeting is welcoming
- [ ] Explanation is clear
- [ ] Code examples are distinguishable
- [ ] Exercise area is obvious

**Code Editor:**
- [ ] Syntax highlighting (dark theme)
- [ ] Placeholder text visible
- [ ] Font is monospace
- [ ] Easy to type in
- [ ] Resizable

**Feedback:**
- [ ] Success is celebratory (emojis, colors)
- [ ] Errors are encouraging
- [ ] Rewards are visible
- [ ] Next steps are clear

### Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA
- [ ] Works with screen reader (basic)
- [ ] Text is scalable
- [ ] No flashing animations

### Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Edge (latest)
- [ ] iOS Safari (iPad)
- [ ] Chrome Mobile (Android)

### Performance Testing

- [ ] Course catalog loads < 2s
- [ ] Lesson loads < 2s
- [ ] Answer validation < 1s
- [ ] No console errors
- [ ] No memory leaks (use for 10 minutes)

---

## Content Testing

### Lesson Quality Checklist

**For Each Lesson:**
- [ ] Title is engaging
- [ ] Character matches lesson theme
- [ ] Greeting is friendly
- [ ] Explanation uses simple language
- [ ] No jargon or complex terms
- [ ] Examples are relevant
- [ ] Fun fact is interesting
- [ ] Exercise is age-appropriate
- [ ] Template provides guidance
- [ ] Hint is actually helpful
- [ ] Validation regex works correctly
- [ ] Success message is celebratory

### Age-Appropriateness (8-12 years)

- [ ] Reading level is appropriate
- [ ] Concepts are simplified
- [ ] Examples relate to kids' lives
- [ ] Humor is kid-friendly
- [ ] No scary or inappropriate content

---

## User Testing

### Beta Testing Protocol

**Participants:** 3-5 children (ages 8-12)

**Setup:**
1. Parent supervises
2. Child uses app independently
3. Observer takes notes
4. No prompting or help

**Observations:**
- [ ] Child understands what to do
- [ ] Can navigate without help
- [ ] Completes at least one lesson
- [ ] Shows engagement (not bored)
- [ ] Asks relevant questions

**Questions After:**
- Did you like the app? (1-5)
- Was anything confusing?
- What did you learn?
- Would you use it again?

### Parent Feedback

- [ ] Feels safe for child
- [ ] Educational value is clear
- [ ] Would recommend to others
- [ ] Concerns or suggestions

---

## Regression Testing

Before each deployment, verify:

### Critical Path
- [ ] Can open app
- [ ] Can see courses
- [ ] Can start lesson
- [ ] Can submit code
- [ ] Can complete lesson
- [ ] Progress saves

### Edge Cases
- [ ] Empty code submission (should warn)
- [ ] Very long code (should handle)
- [ ] Special characters in code
- [ ] Rapid clicking "Check Answer"
- [ ] Browser back button
- [ ] Refresh page mid-lesson

---

## Security Testing

### Input Validation
- [ ] Path traversal blocked (course/lesson IDs)
- [ ] No code execution (no eval or similar)
- [ ] XSS prevention (properly escaped output)
- [ ] User input sanitized

### API Security
- [ ] Rate limiting (optional for MVP)
- [ ] HTTPS only
- [ ] CORS configured correctly
- [ ] No secrets in logs
- [ ] No PII stored

---

## Automated Testing (Future)

### Jest Unit Tests

```javascript
// mcp-server/tests/tools.test.js
describe('MCP Tools', () => {
  test('getCourses returns courses', async () => {
    const result = await getCourses();
    expect(result.success).toBe(true);
    expect(result.data.courses).toHaveLength(1);
  });

  test('checkAnswer validates correctly', async () => {
    const result = await checkAnswer({
      courseId: 'python-kids',
      lessonId: 'lesson-1',
      answer: 'favorite_animal = "cat"'
    });
    expect(result.correct).toBe(true);
  });
});
```

### Playwright E2E Tests

```javascript
// tests/e2e/user-journey.spec.js
test('complete lesson 1', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('text=Python for Kids');
  await page.click('text=Start Learning');
  await page.fill('.code-editor', 'favorite_animal = "cat"');
  await page.click('text=Check My Answer');
  await expect(page.locator('text=Amazing')).toBeVisible();
});
```

---

## Test Data

### Valid Test Inputs

```javascript
// Correct answers for each lesson
const validAnswers = {
  'lesson-1': 'favorite_animal = "cat"\nprint(favorite_animal)',
  'lesson-2': 'my_candies = 7\nfriend_candies = 5\ntotal_candies = my_candies + friend_candies',
  'lesson-3': 'my_name = "Luna"\nwelcome_message = "Welcome, " + my_name + "!"',
  'lesson-4': 'my_hobbies = ["reading", "soccer", "drawing"]',
  'lesson-5': 'def make_introduction(name):\n    return "Hi, I\'m " + name + "!"'
};
```

### Invalid Test Inputs

```javascript
const invalidAnswers = {
  'lesson-1': 'wrong code',
  'lesson-2': '5 + 3',  // Missing variables
  'lesson-3': 'my_name',  // Incomplete
  'lesson-4': '["one"]',  // Only one item
  'lesson-5': 'def wrong():'  // Wrong function name
};
```

---

## Bug Tracking

### Report Template

```markdown
**Title:** Brief description

**Environment:**
- Browser: Chrome 120
- OS: macOS 14
- Deployment: Production

**Steps to Reproduce:**
1. Open app
2. Click course
3. ...

**Expected:** What should happen

**Actual:** What actually happened

**Screenshots:** Attach if relevant

**Console Errors:** Any errors in console

**Severity:**
- Critical (blocks user)
- High (major feature broken)
- Medium (minor issue)
- Low (cosmetic)
```

---

## Test Metrics

Track for each release:

- **Test Pass Rate**: X% of tests passing
- **Critical Bugs**: Count of blocking issues
- **User Satisfaction**: Average rating (1-5)
- **Completion Rate**: % of users finishing Lesson 1
- **Error Rate**: % of tool calls that fail

---

## Testing Schedule

### Pre-Launch
- [ ] All unit tests (tools)
- [ ] Integration testing
- [ ] UI/UX review
- [ ] User testing (3+ kids)
- [ ] Security review

### Weekly (Post-Launch)
- [ ] Smoke test critical path
- [ ] Check error logs
- [ ] Review user feedback

### Before Each Deploy
- [ ] Regression testing
- [ ] Verify all lessons load
- [ ] Check progress persists

---

## Known Limitations (MVP)

Document what's NOT tested:

- ⚠️ Concurrent users (scaling)
- ⚠️ Long-term state persistence
- ⚠️ Offline functionality
- ⚠️ Accessibility (screen readers)
- ⚠️ Internationalization
- ⚠️ Performance under load

---

## Testing Resources

- **MCP Inspector**: `npx @modelcontextprotocol/inspector`
- **Browser DevTools**: Console, Network, Performance tabs
- **Lighthouse**: Accessibility and performance audits
- **User Testing**: Friends/family with kids

---

**Testing is never complete** - iterate based on real usage! 🚀
