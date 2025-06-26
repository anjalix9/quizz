import React, { useState, useEffect, useCallback } from "react";
import "./App.css";

// Fallback questions in case API fails
const fallbackQuestions = [
  {
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    answer: "Paris",
    category: "Geography",
    difficulty: "Easy"
  },
  {
    question: "Who wrote 'Hamlet'?",
    options: ["Shakespeare", "Dickens", "Tolstoy", "Hemingway"],
    answer: "Shakespeare",
    category: "Literature",
    difficulty: "Easy"
  },
  {
    question: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    answer: "4",
    category: "Math",
    difficulty: "Easy"
  }
];

// Fisher-Yates shuffle algorithm
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Shuffle options within each question
const shuffleQuestionOptions = (question) => {
  const shuffledOptions = shuffleArray(question.options);
  const correctAnswer = question.answer;
  
  return {
    ...question,
    options: shuffledOptions,
    answer: correctAnswer
  };
};

// Function to fetch questions from API
const fetchQuestionsFromAPI = async (count = 12) => {
  try {
    // Using Open Trivia Database API (free and reliable)
    const response = await fetch(`https://opentdb.com/api.php?amount=${count}&type=multiple`);
    const data = await response.json();
    
    if (data.response_code === 0 && data.results.length > 0) {
      // Transform API data to our format
      return data.results.map((apiQuestion, index) => {
        const options = shuffleArray([
          ...apiQuestion.incorrect_answers,
          apiQuestion.correct_answer
        ]);
        
        return {
          question: apiQuestion.question,
          options: options,
          answer: apiQuestion.correct_answer,
          category: apiQuestion.category,
          difficulty: apiQuestion.difficulty
        };
      });
    } else {
      throw new Error('No questions available from API');
    }
  } catch (error) {
    console.log('API fetch failed, using fallback questions:', error);
    return null;
  }
};

// Function to get questions (API first, then fallback)
const getQuestions = async (count = 12) => {
  // Try to fetch from API first
  const apiQuestions = await fetchQuestionsFromAPI(count);
  
  if (apiQuestions && apiQuestions.length >= count) {
    return apiQuestions.map(shuffleQuestionOptions);
  }
  
  // If API fails, use fallback questions
  console.log('Using fallback questions');
  const shuffledFallback = shuffleArray(fallbackQuestions);
  return shuffledFallback.slice(0, Math.min(count, fallbackQuestions.length)).map(shuffleQuestionOptions);
};

// Quiz history management functions
const saveQuizAttempt = (userName, score, totalQuestions, date, timeTaken) => {
  const history = getQuizHistory();
  const attempt = {
    id: Date.now(),
    userName,
    score,
    totalQuestions,
    percentage: Math.round((score / totalQuestions) * 100),
    date: date.toISOString(),
    timeTaken,
    timestamp: Date.now()
  };
  
  history.push(attempt);
  // Keep only last 50 attempts to prevent localStorage overflow
  if (history.length > 50) {
    history.splice(0, history.length - 50);
  }
  
  localStorage.setItem('quizHistory', JSON.stringify(history));
};

const getQuizHistory = () => {
  try {
    const history = localStorage.getItem('quizHistory');
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error('Error loading quiz history:', error);
    return [];
  }
};

const clearQuizHistory = () => {
  localStorage.removeItem('quizHistory');
};

const getQuizStats = (history) => {
  if (history.length === 0) return null;
  
  const totalAttempts = history.length;
  const totalScore = history.reduce((sum, attempt) => sum + attempt.score, 0);
  const totalQuestions = history.reduce((sum, attempt) => sum + attempt.totalQuestions, 0);
  const averageScore = Math.round(totalScore / totalAttempts);
  const averagePercentage = Math.round((totalScore / totalQuestions) * 100);
  const bestScore = Math.max(...history.map(attempt => attempt.score));
  const bestPercentage = Math.max(...history.map(attempt => attempt.percentage));
  const worstScore = Math.min(...history.map(attempt => attempt.score));
  const worstPercentage = Math.min(...history.map(attempt => attempt.percentage));
  
  return {
    totalAttempts,
    totalScore,
    totalQuestions,
    averageScore,
    averagePercentage,
    bestScore,
    bestPercentage,
    worstScore,
    worstPercentage
  };
};

function App() {
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showScore, setShowScore] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [userName, setUserName] = useState("");
  const [correctAnswers, setCorrectAnswers] = useState([]);
  const [incorrectAnswers, setIncorrectAnswers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [questionSource, setQuestionSource] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [quizHistory, setQuizHistory] = useState([]);
  const [quizStats, setQuizStats] = useState(null);
  const [startTime, setStartTime] = useState(null);

  const TIME_PER_QUESTION = 30;

  // Check for saved username on component mount
  useEffect(() => {
    const savedName = localStorage.getItem('quizUserName');
    if (savedName) {
      setUserName(savedName);
      setShowStartScreen(false);
    }
    initializeQuiz();
    loadQuizHistory();
  }, []);

  const loadQuizHistory = () => {
    const history = getQuizHistory();
    setQuizHistory(history);
    setQuizStats(getQuizStats(history));
  };

  const initializeQuiz = async () => {
    setIsLoading(true);
    try {
      const questions = await getQuestions(12);
      setQuizQuestions(questions);
      
      // Determine question source for display
      if (questions.length === 12) {
        setQuestionSource("🌐 Live from Open Trivia Database");
      } else {
        setQuestionSource("📚 Local Fallback Questions");
      }
    } catch (error) {
      console.error('Failed to load questions:', error);
      setQuestionSource("📚 Local Fallback Questions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = useCallback(() => {
    const nextQ = currentQuestion + 1;
    if (nextQ < quizQuestions.length) {
      setCurrentQuestion(nextQ);
      setSelectedOption(null);
      setTimeLeft(TIME_PER_QUESTION);
      setIsTimerRunning(true);
    } else {
      setShowScore(true);
      setIsTimerRunning(false);
      // Save quiz attempt when quiz is completed
      const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
      saveQuizAttempt(userName, score, quizQuestions.length, new Date(), timeTaken);
      loadQuizHistory(); // Reload history to show latest attempt
    }
  }, [currentQuestion, quizQuestions.length, score, userName, startTime]);

  const handleTimeUp = useCallback(() => {
    setSelectedOption("timeout");
    setIncorrectAnswers(prev => [...prev, currentQuestion]);
    setTimeout(() => {
      handleNext();
    }, 1500);
  }, [currentQuestion, handleNext]);

  useEffect(() => {
    let timer;
    if (isTimerRunning && timeLeft > 0 && !showScore) {
      timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0 && !showScore) {
      handleTimeUp();
    }
    return () => clearTimeout(timer);
  }, [timeLeft, isTimerRunning, showScore, handleTimeUp]);

  const startQuiz = () => {
    if (userName.trim()) {
      // Save username to localStorage
      localStorage.setItem('quizUserName', userName.trim());
      setShowStartScreen(false);
      setIsTimerRunning(true);
      setTimeLeft(TIME_PER_QUESTION);
      setStartTime(Date.now()); // Record start time
    }
  };

  const handleLogout = () => {
    // Clear saved username and reset to start screen
    localStorage.removeItem('quizUserName');
    setUserName("");
    setShowStartScreen(true);
    setCurrentQuestion(0);
    setScore(0);
    setShowScore(false);
    setSelectedOption(null);
    setTimeLeft(TIME_PER_QUESTION);
    setIsTimerRunning(false);
    setCorrectAnswers([]);
    setIncorrectAnswers([]);
    setShowHistory(false);
  };

  const handleAnswer = (option) => {
    if (selectedOption !== null) return; // prevent multiple clicks
    setSelectedOption(option);
    setIsTimerRunning(false);

    if (option === quizQuestions[currentQuestion].answer) {
      setScore(score + 1);
      setCorrectAnswers([...correctAnswers, currentQuestion]);
      playSound("correct");
    } else {
      setIncorrectAnswers([...incorrectAnswers, currentQuestion]);
      playSound("incorrect");
    }
  };

  const playSound = (type) => {
    // Simple sound effect using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (type === "correct") {
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
    } else {
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime + 0.1);
    }
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  const handleRestart = async () => {
    // Fetch fresh questions from API
    setIsLoading(true);
    try {
      const questions = await getQuestions(12);
      setQuizQuestions(questions);
      
      if (questions.length === 12) {
        setQuestionSource("🌐 Live from Open Trivia Database");
      } else {
        setQuestionSource("📚 Local Fallback Questions");
      }
    } catch (error) {
      console.error('Failed to load new questions:', error);
      setQuestionSource("📚 Local Fallback Questions");
    } finally {
      setIsLoading(false);
    }
    
    setCurrentQuestion(0);
    setScore(0);
    setShowScore(false);
    setShowStartScreen(false);
    setSelectedOption(null);
    setTimeLeft(TIME_PER_QUESTION);
    setIsTimerRunning(true);
    setCorrectAnswers([]);
    setIncorrectAnswers([]);
    setStartTime(Date.now()); // Record new start time
  };

  const getScorePercentage = () => {
    return Math.round((score / quizQuestions.length) * 100);
  };

  const getScoreMessage = () => {
    const percentage = getScorePercentage();
    if (percentage >= 90) return "Excellent! You're a quiz master! 🏆";
    if (percentage >= 80) return "Great job! You really know your stuff! 🌟";
    if (percentage >= 70) return "Good work! Keep learning! 👍";
    if (percentage >= 60) return "Not bad! Room for improvement! 📚";
    return "Keep practicing! You'll get better! 💪";
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "easy": return "#4caf50";
      case "medium": return "#ff9800";
      case "hard": return "#f44336";
      default: return "#4caf50";
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // History Screen Component
  const HistoryScreen = () => (
    <div className="quiz-card history-screen">
      <h2 className="history-title">📊 Quiz History & Statistics</h2>
      
      {quizStats ? (
        <div className="stats-container">
          <h3>📈 Overall Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Total Attempts:</span>
              <span className="stat-value">{quizStats.totalAttempts}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Average Score:</span>
              <span className="stat-value">{quizStats.averageScore}/{quizStats.totalQuestions / quizStats.totalAttempts}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Average %:</span>
              <span className="stat-value">{quizStats.averagePercentage}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Best Score:</span>
              <span className="stat-value">{quizStats.bestScore} ({quizStats.bestPercentage}%)</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Worst Score:</span>
              <span className="stat-value">{quizStats.worstScore} ({quizStats.worstPercentage}%)</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Questions:</span>
              <span className="stat-value">{quizStats.totalQuestions}</span>
            </div>
          </div>
        </div>
      ) : (
        <p style={{ textAlign: "center", color: "#666", marginBottom: 20 }}>
          No quiz attempts yet. Take your first quiz to see statistics!
        </p>
      )}

      <div className="history-list">
        <h3>📝 Recent Attempts</h3>
        {quizHistory.length > 0 ? (
          <div className="attempts-list">
            {quizHistory.slice().reverse().map((attempt, index) => (
              <div key={attempt.id} className="attempt-item">
                <div className="attempt-header">
                  <span className="attempt-number">#{quizHistory.length - index}</span>
                  <span className="attempt-date">{formatDate(attempt.date)}</span>
                </div>
                <div className="attempt-details">
                  <span className="attempt-score">
                    {attempt.score}/{attempt.totalQuestions} ({attempt.percentage}%)
                  </span>
                  <span className="attempt-time">
                    ⏱️ {formatTime(attempt.timeTaken)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: "center", color: "#666" }}>
            No quiz attempts recorded yet.
          </p>
        )}
      </div>

      <div className="history-actions">
        <button onClick={() => setShowHistory(false)} className="back-btn">
          ← Back to Quiz
        </button>
        <button onClick={() => {
          clearQuizHistory();
          loadQuizHistory();
        }} className="clear-history-btn">
          🗑️ Clear History
        </button>
      </div>
    </div>
  );

  if (showStartScreen) {
    return (
      <div className="App">
        <header className="App-header">
          <div className="quiz-card start-screen">
            <h1 style={{ fontSize: 32, marginBottom: 20, color: "#1976d2" }}>
              🧠 Quiz Master 🧠
            </h1>
            <p style={{ fontSize: 18, marginBottom: 30, color: "#666" }}>
              Test your knowledge with our interactive quiz!
            </p>
            
            <div style={{ marginBottom: 30 }}>
              <label style={{ display: "block", marginBottom: 10, fontSize: 16, color: "#333" }}>
                Enter your name:
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Your name here..."
                className="name-input"
                onKeyPress={(e) => e.key === 'Enter' && startQuiz()}
              />
            </div>

            <div style={{ marginBottom: 30 }}>
              <h3 style={{ fontSize: 20, marginBottom: 15, color: "#333" }}>Quiz Info:</h3>
              <div style={{ textAlign: "left", fontSize: 14, color: "#666" }}>
                <p>📝 12 questions per quiz</p>
                <p>⏱️ {TIME_PER_QUESTION} seconds per question</p>
                <p>🌐 Questions from Open Trivia Database API</p>
                <p>📊 Multiple categories and difficulty levels</p>
                <p>🔄 Fresh questions on every restart!</p>
                <p>💾 Your name will be remembered for future visits</p>
                <p>📈 Quiz history and statistics tracking</p>
              </div>
            </div>

            <div className="start-actions">
              <button 
                onClick={startQuiz} 
                className="start-btn"
                disabled={!userName.trim() || isLoading}
              >
                {isLoading ? "Loading Questions..." : "Start Quiz"}
              </button>
              
              {quizStats && (
                <button 
                  onClick={() => setShowHistory(true)} 
                  className="history-btn"
                >
                  📊 View History
                </button>
              )}
            </div>
          </div>
        </header>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="App">
        <header className="App-header">
          <HistoryScreen />
        </header>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="App">
        <header className="App-header">
          <div className="quiz-card">
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 24, marginBottom: 20, color: "#1976d2" }}>
                🔄 Loading Fresh Questions...
              </div>
              <div style={{ fontSize: 16, color: "#666" }}>
                Fetching new questions from the database
              </div>
            </div>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        {!showScore ? (
          <div className="quiz-card">
            {/* Header with progress and timer */}
            <div className="quiz-header">
              <div className="progress-info">
                <span className="question-counter">
                  Question {currentQuestion + 1} of {quizQuestions.length}
                </span>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${((currentQuestion + 1) / quizQuestions.length) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="timer-container">
                <div className="timer" style={{ color: timeLeft <= 10 ? '#f44336' : '#1976d2' }}>
                  ⏱️ {timeLeft}s
                </div>
                <div className="timer-bar">
                  <div 
                    className="timer-fill" 
                    style={{ 
                      width: `${(timeLeft / TIME_PER_QUESTION) * 100}%`,
                      backgroundColor: timeLeft <= 10 ? '#f44336' : '#1976d2'
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* User info and logout */}
            <div className="user-info">
              <span className="welcome-text">Welcome, {userName}! 👋</span>
              <div className="user-actions">
                <button onClick={() => setShowHistory(true)} className="history-btn-small">
                  📊
                </button>
                <button onClick={handleLogout} className="logout-btn">
                  🚪 Logout
                </button>
              </div>
            </div>

            {/* Question source info */}
            <div style={{ 
              textAlign: "center", 
              fontSize: 12, 
              color: "#666", 
              marginBottom: 15,
              fontStyle: "italic"
            }}>
              {questionSource}
            </div>

            {/* Question info */}
            <div className="question-info">
              <span 
                className="category-badge"
                style={{ backgroundColor: getDifficultyColor(quizQuestions[currentQuestion].difficulty) }}
              >
                {quizQuestions[currentQuestion].category}
              </span>
              <span 
                className="difficulty-badge"
                style={{ backgroundColor: getDifficultyColor(quizQuestions[currentQuestion].difficulty) }}
              >
                {quizQuestions[currentQuestion].difficulty}
              </span>
            </div>

            <h3 className="question-text">{quizQuestions[currentQuestion].question}</h3>

            {/* Options */}
            <div className="options-container">
              {quizQuestions[currentQuestion].options.map((option, index) => {
                const isSelected = option === selectedOption;
                const isCorrect = option === quizQuestions[currentQuestion].answer;
                const isTimeout = selectedOption === "timeout";

                let btnClass = "option-btn";
                if (selectedOption !== null || isTimeout) {
                  if (isSelected) {
                    btnClass += isCorrect ? " correct" : " incorrect";
                  } else if (isCorrect) {
                    btnClass += " correct";
                  } else {
                    btnClass += " disabled";
                  }
                }

                const icon = isSelected
                  ? isCorrect
                    ? "✓"
                    : "✗"
                  : isCorrect && (selectedOption !== null || isTimeout)
                  ? "✓"
                  : "";

                return (
                  <button
                    key={option}
                    onClick={() => handleAnswer(option)}
                    disabled={selectedOption !== null || isTimeout}
                    className={btnClass}
                  >
                    <span className="option-letter">{String.fromCharCode(65 + index)}.</span>
                    <span className="option-text">{option}</span>
                    <span className="option-icon">{icon}</span>
                  </button>
                );
              })}
            </div>

            {/* Feedback message */}
            {selectedOption !== null && (
              <div className="feedback-message">
                {selectedOption === quizQuestions[currentQuestion].answer ? (
                  <div className="correct-feedback">🎉 Correct! Well done!</div>
                ) : (
                  <div className="incorrect-feedback">
                    ❌ Wrong! The correct answer is: <strong>{quizQuestions[currentQuestion].answer}</strong>
                  </div>
                )}
              </div>
            )}

            {selectedOption !== null && (
              <button onClick={handleNext} className="next-btn">
                {currentQuestion + 1 === quizQuestions.length ? "Finish Quiz" : "Next Question"}
              </button>
            )}
          </div>
        ) : (
          <div className="quiz-card results-screen">
            <h2 className="results-title">🎯 Quiz Complete!</h2>
            
            <div className="score-display">
              <div className="score-circle">
                <span className="score-number">{score}</span>
                <span className="score-total">/{quizQuestions.length}</span>
              </div>
              <div className="score-percentage">{getScorePercentage()}%</div>
            </div>

            <p className="score-message">{getScoreMessage()}</p>

            <div className="score-breakdown">
              <h3>Score Breakdown:</h3>
              <div className="breakdown-item">
                <span>✅ Correct Answers:</span>
                <span>{score}</span>
              </div>
              <div className="breakdown-item">
                <span>❌ Incorrect Answers:</span>
                <span>{quizQuestions.length - score}</span>
              </div>
              <div className="breakdown-item">
                <span>⏱️ Time Taken:</span>
                <span>{startTime ? formatTime(Math.round((Date.now() - startTime) / 1000)) : "N/A"}</span>
              </div>
            </div>

            <div className="results-actions">
              <button onClick={handleRestart} className="restart-btn">
                🔄 Take Quiz Again (Fresh Questions!)
              </button>
              <button onClick={() => setShowHistory(true)} className="history-btn">
                📊 View History
              </button>
              <button onClick={handleLogout} className="logout-btn">
                🚪 Logout
              </button>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
