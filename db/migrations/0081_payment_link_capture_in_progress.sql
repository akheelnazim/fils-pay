-- A capture can outlive the reservation timeout. Keep its transaction on the
-- link until the capture is resolved so a second buyer cannot claim it.
ALTER TABLE payment_links
    ADD COLUMN capture_transaction_id UUID REFERENCES transactions(id),
    ADD CONSTRAINT payment_links_capture_reserved_check
      CHECK (capture_transaction_id IS NULL OR status = 'reserved');
