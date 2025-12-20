import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Question } from '@/types/game';
import { Brain, Zap, CheckCircle2, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQuestionNarration } from '@/hooks/useQuestionNarration';

interface QuestionCardProps {
  question: Question;
  showCorrectAnswer: boolean;
  selectedOption?: string;
  onSelectOption?: (option: 'A' | 'B' | 'C' | 'D') => void;
  disabled?: boolean;
  confirmedAnswer?: string;
  autoNarrate?: boolean;
  onNarrationComplete?: () => void;
}

export default function QuestionCard({
  question,
  showCorrectAnswer,
  selectedOption,
  onSelectOption,
  disabled = false,
  confirmedAnswer,
  autoNarrate = true,
  onNarrationComplete,
}: QuestionCardProps) {
  const [showCategory, setShowCategory] = useState(true);
  const [showQuestion, setShowQuestion] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [hasNarrated, setHasNarrated] = useState(false);

  const { isNarrating, isLoading, narrateQuestion, stopNarration } = useQuestionNarration({
    enabled: autoNarrate,
    onNarrationStart: () => {
      console.log('[QuestionCard] Narration started');
    },
    onNarrationEnd: () => {
      console.log('[QuestionCard] Narration ended');
      onNarrationComplete?.();
    },
  });

  const options = [
    { key: 'A' as const, text: question.option_a },
    { key: 'B' as const, text: question.option_b },
    { key: 'C' as const, text: question.option_c },
    { key: 'D' as const, text: question.option_d },
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'text-success';
      case 'Medium': return 'text-warning';
      case 'Hard': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const isCorrect = (key: string) => showCorrectAnswer && key === question.correct_option;
  const isWrong = (key: string) => showCorrectAnswer && confirmedAnswer === key && key !== question.correct_option;
  const isPlayerChoice = (key: string) => confirmedAnswer === key;

  // Handle question changes and animations
  useEffect(() => {
    // Reset states for new question
    setHasNarrated(false);
    setShowCategory(true);
    setShowQuestion(false);
    setShowOptions(false);

    if (!autoNarrate) {
      // If not auto-narrating, show everything immediately
      setShowQuestion(true);
      setShowOptions(true);
      return;
    }

    // Start narration in sync with category display
    const narrateTimer = setTimeout(() => {
      narrateQuestion(question);
      setHasNarrated(true);
    }, 500);

    // Show question text after category intro
    const questionTimer = setTimeout(() => {
      setShowQuestion(true);
    }, 1200);

    // Show options after question
    const optionsTimer = setTimeout(() => {
      setShowOptions(true);
    }, 2000);

    return () => {
      clearTimeout(narrateTimer);
      clearTimeout(questionTimer);
      clearTimeout(optionsTimer);
      stopNarration();
    };
  }, [question.id, autoNarrate, narrateQuestion, stopNarration]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header with category animation */}
      <AnimatePresence mode="wait">
        {showCategory && (
          <motion.div
            key="category"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center justify-between"
          >
            <motion.div 
              className="flex items-center gap-2"
              initial={{ x: -20 }}
              animate={{ x: 0 }}
            >
              <Brain className="w-5 h-5 text-primary" />
              <motion.span 
                className="text-sm font-medium text-muted-foreground uppercase tracking-wider"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {question.category}
              </motion.span>
              
              {/* Subtle narration indicator - only shows when actively playing */}
              {isNarrating && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="ml-2"
                >
                  <Volume2 className="w-4 h-4 text-primary/60 animate-pulse" />
                </motion.div>
              )}
            </motion.div>
            
            <div className={cn('flex items-center gap-1', getDifficultyColor(question.difficulty))}>
              <Zap className="w-4 h-4" />
              <span className="text-sm font-orbitron">{question.difficulty}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question with reveal animation */}
      <AnimatePresence>
        {showQuestion && (
          <motion.h2
            key="question"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-2xl font-orbitron font-semibold text-foreground leading-relaxed"
          >
            {question.question_text}
          </motion.h2>
        )}
      </AnimatePresence>

      {/* Options with staggered reveal */}
      <AnimatePresence>
        {showOptions && (
          <motion.div 
            key="options"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {options.map((option, index) => (
              <motion.button
                key={option.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.15 }}
                onClick={() => !disabled && !confirmedAnswer && onSelectOption?.(option.key)}
                disabled={disabled || !!confirmedAnswer}
                className={cn(
                  'option-card text-left relative',
                  isCorrect(option.key) && 'ring-2 ring-success bg-success/10',
                  isWrong(option.key) && 'ring-2 ring-destructive bg-destructive/10',
                  selectedOption === option.key && !confirmedAnswer && 'selected',
                  isPlayerChoice(option.key) && !isCorrect(option.key) && !isWrong(option.key) && 'ring-2 ring-primary',
                  (disabled || !!confirmedAnswer) && 'cursor-default'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-orbitron font-bold',
                    isCorrect(option.key) ? 'bg-success text-success-foreground' : 
                    isWrong(option.key) ? 'bg-destructive text-destructive-foreground' : 
                    'bg-primary/20 text-primary'
                  )}>
                    {isCorrect(option.key) ? <CheckCircle2 className="w-5 h-5" /> : option.key}
                  </span>
                  <span className="text-lg font-medium pt-1">{option.text}</span>
                </div>
                {isCorrect(option.key) && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-success text-success-foreground text-xs font-bold px-2 py-1 rounded-full"
                  >
                    CORRETA
                  </motion.div>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
