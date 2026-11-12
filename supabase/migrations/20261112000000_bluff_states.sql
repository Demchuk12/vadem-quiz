-- The round of the "Варіанти" mode: players write a lie, vote for what they take as the truth, then
-- everything is revealed. A value added to an enum cannot be used in the transaction that adds it,
-- so the states come in a migration of their own.

alter type public.room_state add value 'bluff_writing';
alter type public.room_state add value 'bluff_voting';
alter type public.room_state add value 'bluff_reveal';
