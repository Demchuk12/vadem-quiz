-- "Господар", a fourth game: players walk a ring of 32 cells, buy land and charge rent. A value
-- added to an enum cannot be used in the transaction that adds it, so the state comes first. The
-- turn itself has its steps in `rooms.estate_step`, not in the room state.

alter type public.room_state add value 'estate_playing';
