import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Question } from '@/types/game';
import { Brain, Zap, CheckCircle2 } from 'lucide-react';

interface QuestionCardProps {
  question: Question;
  showCorrectAnswer: boolean;
  selectedOption?: string;
  onSelectOption?: (option: 'A' | 'B' | 'C' | 'D') => void;
  disabled?: boolean;
  confirmedAnswer?: string;
}

export default function QuestionCard({
  question,
  showCorrectAnswer,
  selectedOption,
  onSelectOption,
  disabled = false,
  confirmedAnswer,
}: QuestionCardProps) {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {question.category}
          </span>
        </div>
        <div className={cn('flex items-center gap-1', getDifficultyColor(question.difficulty))}>
          <Zap className="w-4 h-4" />
          <span className="text-sm font-orbitron">{question.difficulty}</span>
        </div>
      </div>

      {/* Question */}
      <h2 className="text-2xl font-orbitron font-semibold text-foreground leading-relaxed">
        {question.question_text}
      </h2>

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((option, index) => (
          <motion.button
            key={option.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
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
      </div>
    </motion.div>
  );
}
