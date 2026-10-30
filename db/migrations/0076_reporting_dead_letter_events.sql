-- X6: one malformed outbox event used to fail every reporting pass, so the
-- watermark never moved again. Events whose payload can't be applied (a data
-- error) are now set aside here and the pass carries on; someone fixes the
-- event and replays it. One row per consumer per event.
CREATE TABLE reporting_dead_letter_events (
    consumer_name    TEXT        NOT NULL,
    outbox_event_id  BIGINT      NOT NULL,
    event_type       TEXT        NOT NULL,
    error            TEXT        NOT NULL,
    failed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (consumer_name, outbox_event_id)
);
