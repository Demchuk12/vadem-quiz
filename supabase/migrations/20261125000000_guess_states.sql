-- The question of the "На око" mode: players enter a number, then everything is revealed. A value
-- added to an enum cannot be used in the transaction that adds it, so the states come first.

alter type public.room_state add value 'guess_open';
alter type public.room_state add value 'guess_reveal';
