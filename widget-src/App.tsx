import { useState, useEffect, useMemo, useRef } from 'react';
import { useWidgetState, useWidgetProps, useOpenAiGlobal } from './hooks';
import './styles.css';

// Types
interface Course {
  id: string;
  title: string;
  emoji: string;
  description: string;
  color: string;
  ageRange: string;
  difficulty: string;
  totalLessons: number;
  estimatedDuration: string;
}

interface LessonContent {
  character: string;
  characterName: string;
  greeting: string;
  explanation: string;
  examples?: Array<{ code: string; explanation: string }>;
  funFact?: string;
}

interface Exercise {
  instruction: string;
  template: string;
  hint?: string;
}

interface Lesson {
  id: string;
  courseId?: string;
  order: number;
  title: string;
  duration: string;
  objective: string;
  content: LessonContent;
  examples?: Array<{ code: string; explanation: string }>;
  exercise?: Exercise;
  isFinalLesson?: boolean;
  completionMessage?: string;
}

interface WidgetProgress {
  version: string;
  progress: {
    completedLessons: string[];
    earnedStars: number;
  };
  currentCourseId?: string;
  lastAccessed?: string;
}

interface ToolOutputData {
  courses?: Course[];
  course?: Course;
  lesson?: Lesson;
  courseId?: string;
  validation?: {
    correct: boolean;
    hasAttempt: boolean;
    message?: string;
    reward?: { stars: number; badge?: string };
    nextLesson?: string;
    hint?: string;
    error?: string;
  };
}

// Utility function to call MCP tools
type CallToolApi = Window['openai'] extends { callTool?: infer T } ? T : undefined;

async function invokeCallTool(
  callToolApi: CallToolApi,
  name: string,
  parameters: Record<string, unknown>
) {
  if (!callToolApi) {
    throw new Error('callTool not available - check ChatGPT connection');
  }

  const payload = { name, parameters, arguments: parameters };
  const callToolFn = callToolApi as (...args: unknown[]) => Promise<unknown>;
  const prefersObject = typeof callToolApi === 'function' && callToolApi.length < 2;

  try {
    return prefersObject
      ? await callToolFn(payload)
      : await callToolFn(name, parameters);
  } catch (error) {
    if (!prefersObject) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldRetry = message.includes('422')
        || message.toLowerCase().includes('unprocessable')
        || message.toLowerCase().includes('call_mcp')
        || message.toLowerCase().includes('something went wrong');
      if (shouldRetry) {
        return await callToolFn(payload);
      }
    }
    throw error;
  }
}

async function callTool(
  name: string,
  parameters: Record<string, unknown> = {},
  callToolApi: CallToolApi = window.openai?.callTool
) {
  console.log('[LearnKids] callTool called:', name, 'window.openai:', !!window.openai);

  if (!window.openai) {
    throw new Error('OpenAI runtime not available - widget must be loaded via ChatGPT');
  }

  console.log('[LearnKids] Calling tool:', name, parameters);

  try {
    const response = await invokeCallTool(callToolApi, name, parameters);
    console.log('[LearnKids] Tool response:', response);

    // The server returns data in structuredContent, not in content[0].text
    // structuredContent contains the actual structured data (courses, lessons, etc.)
    if (response.structuredContent) {
      return response.structuredContent;
    }

    // Fallback: try to parse content text as JSON (for backwards compatibility)
    if (response.content?.[0]?.text) {
      try {
        return JSON.parse(response.content[0].text);
      } catch {
        // If not JSON, return as-is
        return { message: response.content[0].text };
      }
    }

    return response;
  } catch (toolError) {
    console.error('[LearnKids] callTool error:', toolError);
    throw new Error(`Tool call failed: ${toolError instanceof Error ? toolError.message : String(toolError)}`);
  }
}

// Loading Spinner
function LoadingSpinner() {
  return (
    <div className="loading-container">
      <div className="spinner">🌟</div>
      <p>Loading your awesome courses...</p>
    </div>
  );
}

// Error Message
function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-container">
      <div className="error-emoji">😅</div>
      <h2>Oops! Something went wrong</h2>
      <p>{message || "Let's try that again!"}</p>
      <button className="button button-primary" onClick={onRetry}>
        🔄 Try Again
      </button>
    </div>
  );
}

// Course Card
function CourseCard({ course, onSelect }: { course: Course; onSelect: (id: string) => void }) {
  return (
    <div className="course-card" style={{ borderLeft: `6px solid ${course.color}` }}>
      <div className="course-emoji">{course.emoji}</div>
      <h3 className="course-title">{course.title}</h3>
      <p className="course-description">{course.description}</p>

      <div className="course-meta">
        <span className="meta-item">
          <span className="meta-icon">👦</span>
          {course.ageRange}
        </span>
        <span className="meta-item">
          <span className="meta-icon">📚</span>
          {course.totalLessons} lessons
        </span>
        <span className="meta-item">
          <span className="meta-icon">⏱️</span>
          {course.estimatedDuration}
        </span>
      </div>

      <button className="button button-primary" onClick={() => onSelect(course.id)}>
        Start Learning! 🚀
      </button>
    </div>
  );
}

// Course Catalog
function CourseCatalog({ courses, onSelectCourse }: { courses: Course[]; onSelectCourse: (id: string) => void }) {
  return (
    <div className="catalog-container">
      <div className="catalog-header">
        <h1 className="app-title">
          <span className="title-emoji">🎓</span>
          LearnKids AI
        </h1>
        <p className="app-subtitle">Choose a course and start your coding adventure!</p>
      </div>

      <div className="courses-grid">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} onSelect={onSelectCourse} />
        ))}
      </div>
    </div>
  );
}

// Lesson Viewer
function LessonViewer({
  lesson,
  courseId,
  onBack,
  onComplete,
}: {
  lesson: Lesson;
  courseId: string;
  onBack: () => void;
  onComplete: (lessonId: string, result: NonNullable<ToolOutputData['validation']>) => void;
}) {
  const [userCode, setUserCode] = useState(lesson.exercise?.template || '');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<NonNullable<ToolOutputData['validation']> | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setUserCode(lesson.exercise?.template || '');
    setResult(null);
    setShowHint(false);
    setChecking(false);
  }, [lesson.id, lesson.exercise?.template]);

  const handleCheckAnswer = async () => {
    setChecking(true);
    setResult(null);

    try {
      const data = await callTool('check-student-work', {
        courseId,
        lessonNumber: lesson.order,
        studentCode: userCode,
      });

      const validationResult = data.validation || data;
      setResult(validationResult);

      if (validationResult.correct) {
        setTimeout(() => {
          onComplete(lesson.id, validationResult);
        }, 2000);
      }
    } catch (error) {
      setResult({
        correct: false,
        hasAttempt: true,
        message: 'Something went wrong. Please try again!',
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="lesson-container">
      {/* Header */}
      <div className="lesson-header">
        <button className="back-button" onClick={onBack}>
          ← Back to courses
        </button>
        <h2 className="lesson-title">{lesson.title}</h2>
        <div className="lesson-meta">
          Lesson {lesson.order} • {lesson.duration}
        </div>
      </div>

      {/* Character & Greeting */}
      <div className="lesson-character">
        <div className="character-emoji">{lesson.content.character}</div>
        <div className="character-name">{lesson.content.characterName}</div>
        <div className="character-greeting">{lesson.content.greeting}</div>
      </div>

      {/* Explanation */}
      <div className="lesson-explanation">
        <h3>📖 Let's Learn</h3>
        <div className="explanation-text">
          {lesson.content.explanation.split('\n').map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>
      </div>

      {/* Examples */}
      {lesson.content.examples && lesson.content.examples.length > 0 && (
        <div className="lesson-examples">
          <h3>💡 Examples</h3>
          {lesson.content.examples.map((example, idx) => (
            <div key={idx} className="example-item">
              <div className="code-block">{example.code}</div>
              <div className="example-explanation">{example.explanation}</div>
            </div>
          ))}
        </div>
      )}

      {/* Fun Fact */}
      {lesson.content.funFact && (
        <div className="fun-fact">
          <span className="fun-fact-icon">🤓</span>
          <strong>Fun Fact:</strong> {lesson.content.funFact}
        </div>
      )}

      {/* Exercise */}
      {lesson.exercise && (
        <div className="lesson-exercise">
          <h3>✏️ Your Turn!</h3>
          <p className="exercise-instruction">{lesson.exercise.instruction}</p>

          <div className="code-editor-container">
            <textarea
              className="code-editor"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value)}
              rows={6}
              spellCheck={false}
              placeholder="Write your code here..."
            />
          </div>

          <div className="exercise-actions">
            <button
              className="button button-primary"
              onClick={handleCheckAnswer}
              disabled={checking || !userCode.trim()}
            >
              {checking ? '⏳ Checking...' : '✅ Check My Answer'}
            </button>

            {lesson.exercise.hint && !showHint && (
              <button className="button button-secondary" onClick={() => setShowHint(true)}>
                💡 Need a Hint?
              </button>
            )}
          </div>

          {/* Hint */}
          {showHint && lesson.exercise.hint && (
            <div className="hint-box">
              <strong>💡 Hint:</strong> {lesson.exercise.hint}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`result-box ${result.correct ? 'success' : 'error'}`}>
              <div className="result-icon">{result.correct ? '🎉' : '💪'}</div>
              <div className="result-message">
                {result.message || (result.correct ? 'Great job!' : 'Keep trying!')}
              </div>

              {result.correct && result.reward && (
                <div className="reward-box">
                  <div className="reward-stars">{'⭐'.repeat(result.reward.stars || 1)}</div>
                  {result.reward.badge && (
                    <div className="reward-badge">🏆 Badge Earned: {result.reward.badge}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Completion Message */}
      {lesson.isFinalLesson && lesson.completionMessage && result?.correct && (
        <div className="completion-message">
          <div className="completion-icon">🎓</div>
          <h2>Course Complete!</h2>
          <div className="completion-text">{lesson.completionMessage}</div>
        </div>
      )}
    </div>
  );
}

// Main App Component
export default function App() {
  const theme = useOpenAiGlobal('theme') || 'light';
  const callToolApi = useOpenAiGlobal('callTool');
  const defaultToolOutput = useMemo<ToolOutputData>(() => ({}), []);
  const toolOutput = useWidgetProps<ToolOutputData>(defaultToolOutput);

  const [widgetState, setWidgetState] = useWidgetState<WidgetProgress>({
    version: '1.0',
    progress: {
      completedLessons: [],
      earnedStars: 0,
    },
  });

  const [view, setView] = useState<'loading' | 'catalog' | 'lesson' | 'error'>('loading');
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track component mount state to prevent state updates after unmount
  // Fix for race condition in setTimeout - Claude (Opus 4.5) - 2025-12-27
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize: Check if we have data from tool output or need to fetch
  useEffect(() => {
    async function initialize() {
      console.log('[LearnKids] Initializing widget...');
      console.log('[LearnKids] toolOutput:', toolOutput);
      console.log('[LearnKids] window.openai:', window.openai);

      try {
        // If we have courses from tool output, use those
        if (toolOutput?.courses) {
          console.log('[LearnKids] Found courses in toolOutput:', toolOutput.courses.length);
          setCourses(toolOutput.courses);
          setView('catalog');
          return;
        }

        // If we have a lesson from tool output, show it
        if (toolOutput?.lesson) {
          console.log('[LearnKids] Found lesson in toolOutput:', toolOutput.lesson.title);
          const resolvedCourseId = toolOutput.courseId
            || toolOutput.lesson.courseId
            || widgetState.currentCourseId
            || null;
          if (resolvedCourseId) {
            setCurrentCourseId(resolvedCourseId);
          }
          setCurrentLesson(toolOutput.lesson);
          setView('lesson');
          return;
        }

        if (!callToolApi) {
          console.log('[LearnKids] callTool not ready yet, waiting for host...');
          return;
        }

        // No tool output - try to fetch courses
        console.log('[LearnKids] No toolOutput, attempting to call get-courses...');
        const data = await callTool('get-courses', {}, callToolApi);
        console.log('[LearnKids] get-courses response:', data);

        if (data?.courses) {
          setCourses(data.courses);
          setView('catalog');
        } else {
          setError('No courses found in response');
          setView('error');
        }
      } catch (err) {
        console.error('[LearnKids] Initialization error:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage || 'Unknown error loading courses');
        setView('error');
      }
    }

    initialize();
  }, [toolOutput, callToolApi, widgetState.currentCourseId]);

  // Handle course selection
  const handleSelectCourse = async (courseId: string) => {
    try {
      setView('loading');

      const data = await callTool('start-lesson', {
        courseId,
        lessonNumber: 1,
      }, callToolApi ?? undefined);

      if (data?.lesson) {
        setCurrentCourseId(courseId);
        setCurrentLesson(data.lesson);
        setView('lesson');
      } else {
        setError('Failed to load lesson');
        setView('error');
      }
    } catch (err) {
      console.error('[LearnKids] Error loading lesson:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lesson');
      setView('error');
    }
  };

  // Handle lesson completion
  const handleLessonComplete = async (lessonId: string, result: NonNullable<ToolOutputData['validation']>) => {
    const newProgress = {
      ...widgetState,
      progress: {
        completedLessons: [...new Set([...widgetState.progress.completedLessons, lessonId])],
        earnedStars: widgetState.progress.earnedStars + (result.reward?.stars || 1),
      },
      currentCourseId,
      lastAccessed: new Date().toISOString(),
    };
    setWidgetState(newProgress);

    // Load next lesson if available
    // Fixed: Check isMountedRef before state update to prevent race condition
    // Claude (Opus 4.5) - 2025-12-27
    if (result.nextLesson && currentLesson && !currentLesson.isFinalLesson && currentCourseId) {
      setTimeout(async () => {
        if (!isMountedRef.current) return; // Prevent state update if unmounted

        try {
          const nextLessonNumber = parseInt(result.nextLesson?.replace('lesson-', '') || '0');
          const data = await callTool('start-lesson', {
            courseId: currentCourseId,
            lessonNumber: nextLessonNumber,
          }, callToolApi ?? undefined);

          if (data?.lesson && isMountedRef.current) {
            setCurrentLesson(data.lesson);
          }
        } catch (err) {
          console.error('[LearnKids] Error loading next lesson:', err);
        }
      }, 3000);
    }
  };

  // Handle back to catalog
  const handleBackToCatalog = () => {
    setCurrentLesson(null);
    setCurrentCourseId(null);
    setView('catalog');
  };

  // Handle retry after error
  const handleRetry = () => {
    setError(null);
    setView('loading');
    window.location.reload();
  };

  // Render based on view
  return (
    <div className={`app-container theme-${theme}`}>
      {view === 'loading' && <LoadingSpinner />}
      {view === 'error' && <ErrorMessage message={error || 'Unknown error'} onRetry={handleRetry} />}
      {view === 'catalog' && <CourseCatalog courses={courses} onSelectCourse={handleSelectCourse} />}
      {view === 'lesson' && currentLesson && (
        <LessonViewer
          lesson={currentLesson}
          courseId={currentCourseId || ''}
          onBack={handleBackToCatalog}
          onComplete={handleLessonComplete}
        />
      )}
    </div>
  );
}
