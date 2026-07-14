import { supabase } from './supabase';

/** The 3 fixed Hinge-style slots written by finish-ques.tsx during onboarding.
 *  Profile's prompts editor reuses this same shape/table rather than forking
 *  its own representation. */
export const PROMPT_SLOTS = ['slot1', 'slot2', 'slot3'] as const;
export type PromptSlotId = (typeof PROMPT_SLOTS)[number];

export interface PromptSlotData {
  question: string;
  answer: string;
}

export type PromptSlots = Record<PromptSlotId, PromptSlotData>;

export const EMPTY_PROMPT_SLOTS: PromptSlots = {
  slot1: { question: '', answer: '' },
  slot2: { question: '', answer: '' },
  slot3: { question: '', answer: '' },
};

function isPromptSlotId(value: string): value is PromptSlotId {
  return (PROMPT_SLOTS as readonly string[]).includes(value);
}

/** Fetches the caller's own 3 prompt slots, filled in wherever answered. */
export async function getUserPrompts(): Promise<{ success: boolean; data?: PromptSlots; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { data, error } = await supabase
      .from('user_prompts')
      .select('prompt_id, question, answer')
      .eq('user_id', user.id);

    if (error) return { success: false, error: error.message };

    const slots: PromptSlots = {
      slot1: { ...EMPTY_PROMPT_SLOTS.slot1 },
      slot2: { ...EMPTY_PROMPT_SLOTS.slot2 },
      slot3: { ...EMPTY_PROMPT_SLOTS.slot3 },
    };
    for (const row of data ?? []) {
      if (isPromptSlotId(row.prompt_id)) {
        slots[row.prompt_id] = { question: row.question, answer: row.answer };
      }
    }

    return { success: true, data: slots };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Upserts whichever slots have a question selected -- matches
 *  finish-ques.tsx's existing save behavior (empty/unselected slots are
 *  simply skipped, not written as blank rows). */
export async function saveUserPrompts(slots: PromptSlots): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const upsertData = PROMPT_SLOTS
      .filter((slotId) => slots[slotId].question)
      .map((slotId) => ({
        user_id: user.id,
        prompt_id: slotId,
        question: slots[slotId].question,
        answer: slots[slotId].answer,
        is_custom: false,
      }));

    if (upsertData.length === 0) return { success: true };

    const { error } = await supabase
      .from('user_prompts')
      .upsert(upsertData, { onConflict: 'user_id,prompt_id' });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
