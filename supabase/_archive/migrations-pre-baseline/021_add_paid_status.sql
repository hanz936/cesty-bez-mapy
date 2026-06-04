-- Přidat "paid" do CHECK constraint pro status v custom_itinerary_requests
ALTER TABLE custom_itinerary_requests
  DROP CONSTRAINT IF EXISTS custom_itinerary_requests_status_check;

ALTER TABLE custom_itinerary_requests
  ADD CONSTRAINT custom_itinerary_requests_status_check
  CHECK (status IN ('new', 'paid', 'in_progress', 'completed', 'cancelled'));
