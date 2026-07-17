-- Migration to ensure execution permissions are granted to authenticated users for record_swipe and rewind_last_swipe
GRANT EXECUTE ON FUNCTION public.record_swipe(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rewind_last_swipe() TO authenticated;
