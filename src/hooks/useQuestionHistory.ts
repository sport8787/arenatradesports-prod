import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Question } from '@/types/game';
import { getOrCreateSessionId, uniqueQuestionsByText } from '@/lib/gameUtils';

interface UseQuestionHistoryResult {
  questions: Question[];
  loading: boolean;
  getNextQuestion: () => Question | null;
  registerQuestionUsed: (questionId: string) => Promise<void>;
  resetHistory: () => Promise<void>;
}

// Helper to check if a string is a valid UUID
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

export function useQuestionHistory(userId?: string): UseQuestionHistoryResult {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [usedQuestionIds, setUsedQuestionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  
  // Use session ID as fallback for guest users
  const sessionId = getOrCreateSessionId();
  const effectiveUserId = userId || sessionId;
  
  // Check if we can persist to database (only if userId is a valid UUID)
  const canPersist = isValidUUID(effectiveUserId);

  // Load questions and user's history
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      try {
        // Step 1: Load all questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*');
        
        if (questionsError) {
          console.error('Error loading questions:', questionsError);
          return;
        }
        
        const uniqueQuestions = uniqueQuestionsByText(questionsData as Question[]);
        setQuestions(uniqueQuestions);
        
        // Step 2: Load user's question history (only if we have a valid UUID)
        if (canPersist) {
          const { data: historyData, error: historyError } = await supabase
            .from('user_question_history')
            .select('question_id')
            .eq('user_id', effectiveUserId);
          
          if (historyError) {
            console.error('Error loading question history:', historyError);
            // Continue without history - will be fresh start
          } else if (historyData) {
            const usedIds = new Set(historyData.map(h => h.question_id));
            setUsedQuestionIds(usedIds);
            
            console.log(`[QuestionHistory] Loaded ${uniqueQuestions.length} questions, ${usedIds.size} already used`);
          }
        } else {
          console.log(`[QuestionHistory] Guest mode - history stored in memory only`);
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [effectiveUserId, canPersist]);

  // Get next question that hasn't been used
  const getNextQuestion = useCallback((): Question | null => {
    if (questions.length === 0) return null;
    
    // Filter out used questions
    const availableQuestions = questions.filter(q => !usedQuestionIds.has(q.id));
    
    console.log(`[QuestionHistory] Available: ${availableQuestions.length}/${questions.length}`);
    
    if (availableQuestions.length === 0) {
      // User has seen all questions - reset history and start fresh
      console.log('[QuestionHistory] All questions used, will reset on next question');
      return null; // Signal that reset is needed
    }
    
    // Select random question from available pool
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    return availableQuestions[randomIndex];
  }, [questions, usedQuestionIds]);

  // Register a question as used
  const registerQuestionUsed = useCallback(async (questionId: string) => {
    // Update local state immediately
    setUsedQuestionIds(prev => new Set([...prev, questionId]));
    
    // Only persist to database if we have a valid UUID
    if (!canPersist) {
      console.log(`[QuestionHistory] Guest mode - question ${questionId} tracked locally only`);
      return;
    }
    
    // Persist to database
    try {
      const { error } = await supabase
        .from('user_question_history')
        .upsert({
          user_id: effectiveUserId,
          question_id: questionId
        }, {
          onConflict: 'user_id,question_id'
        });
      
      if (error) {
        console.error('Error registering question:', error);
      } else {
        console.log(`[QuestionHistory] Registered question ${questionId}`);
      }
    } catch (err) {
      console.error('Error in registerQuestionUsed:', err);
    }
  }, [effectiveUserId, canPersist]);

  // Reset user's history (when they've seen all questions)
  const resetHistory = useCallback(async () => {
    // Clear local state
    setUsedQuestionIds(new Set());
    
    // Only clear from database if we have a valid UUID
    if (!canPersist) {
      console.log('[QuestionHistory] Guest mode - local history reset');
      return;
    }
    
    // Clear from database
    try {
      const { error } = await supabase
        .from('user_question_history')
        .delete()
        .eq('user_id', effectiveUserId);
      
      if (error) {
        console.error('Error resetting history:', error);
      } else {
        console.log('[QuestionHistory] History reset - fresh start');
      }
    } catch (err) {
      console.error('Error in resetHistory:', err);
    }
  }, [effectiveUserId, canPersist]);

  return {
    questions,
    loading,
    getNextQuestion,
    registerQuestionUsed,
    resetHistory
  };
}
