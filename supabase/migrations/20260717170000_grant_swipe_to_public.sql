-- Migration to grant execute permissions to PUBLIC for record_swipe and rewind_last_swipe
-- Gating is securely handled inside the function bodies using auth.uid() checks
GRANT EXECUTE ON FUNCTION public.record_swipe(UUID, TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.rewind_last_swipe() TO PUBLIC;
