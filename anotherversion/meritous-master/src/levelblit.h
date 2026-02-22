//
//   levelblit.h
//
//   Copyright 2007, 2008 Lancer-X/ASCEAI
//
//   This file is part of Meritous.
//
//   Meritous is free software: you can redistribute it and/or modify
//   it under the terms of the GNU General Public License as published by
//   the Free Software Foundation, either version 3 of the License, or
//   (at your option) any later version.
//
//   Meritous is distributed in the hope that it will be useful,
//   but WITHOUT ANY WARRANTY; without even the implied warranty of
//   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//   GNU General Public License for more details.
//
//   You should have received a copy of the GNU General Public License
//   along with Meritous.  If not, see <http://www.gnu.org/licenses/>.
//

// Exposes levelblit.c functionality and types

#ifndef LEVELBLIT_H
#define LEVELBLIT_H

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
/* em_img_load: wraps IMG_Load, extracting R channel into a 1-byte-per-pixel
   indexed buffer so C pixel writes and em_indexed_blit work correctly. */
SDL_Surface *em_img_load(const char *path);
/* em_indexed_blit: copies 8-bit indexed pixels from src to dst (usually screen),
   honouring the JS-side colorKey for transparency. */
void em_indexed_blit(SDL_Surface *src, SDL_Rect *srcrect,
                     SDL_Surface *dst, SDL_Rect *dstrect);
/* em_fill_rect: fills a rectangle directly in screen->pixels (8-bit indexed),
   so VideoUpdate's putImageData includes it (SDL_FillRect on HWPALETTE
   draws to canvas ctx which putImageData then overwrites). */
void em_fill_rect(SDL_Surface *dst, SDL_Rect *rect, unsigned char c);
/* em_set_colorkey: stores the colorKey for a surface (SDL_SetColorKey is no-op) */
void em_set_colorkey(SDL_Surface *surf, int key);
#define EM_IMG_Load em_img_load
#define EM_BLIT(src, sr, dst, dr) em_indexed_blit(src, sr, dst, dr)
#define EM_FILL(dst, rect, c) em_fill_rect(dst, rect, c)
/* Replace SDL_SetColorKey with our tracker on Emscripten */
#define SDL_SetColorKey(surf, flags, key) em_set_colorkey(surf, key)
#else
#define EM_IMG_Load IMG_Load
#define EM_BLIT(src, sr, dst, dr) SDL_BlitSurface(src, sr, dst, dr)
#define EM_FILL(dst, rect, c) SDL_FillRect(dst, rect, c)
#endif

#define PLAYERW 16
#define PLAYERH 24

extern SDL_Surface *screen;

extern int player_x, player_y;
extern int scroll_x, scroll_y;
extern int player_room;
extern int prv_player_room;

extern int magic_circuit;
extern int circuit_size;
extern int circuit_range;
void DrawCircle(int x, int y, int r, unsigned char c);
void DrawCircleEx(int x, int y, int r, int r2, unsigned char c);
void DrawRect(int x, int y, int w, int h, unsigned char c);
int IsSolid(unsigned char tile);
void draw_char(int cur_x, int cur_y, int c, Uint8 tcol);
void draw_text(int x, int y, char *str, Uint8 tcol);
void draw_text_ex(int x, int y, char *str, Uint8 tcol, SDL_Surface *srf);

extern int player_shield;
extern int shield_hp;
extern int shield_recover;
extern int player_hp;
extern int player_lives;
extern int player_lives_part;
extern int enter_room_x, enter_room_y;

extern int player_dying;

extern int checkpoint_x;
extern int checkpoint_y;

extern int player_gems;

extern int specialmessage;
extern int specialmessagetimer;

extern int tele_select;

void WritePlayerData();
void ReadPlayerData();

extern int artifacts[];

void LoadingScreen(int part, float progress);
void SavingScreen(int part, float progress);

void ThinLine(SDL_Surface *scr, int x1, int y1, int x2, int y2, Uint8 col);
float RandomDir();

void Arc(SDL_Surface *s, int x, int y, int r, float dir);

extern SDL_Surface *artifact_spr;

void VideoUpdate();
void EndCycle(int n);

extern int enter_pressed;

extern int game_paused;

extern int key_held[];

extern int training;
extern int show_ending;

void DrawLevel(int off_x, int off_y, int hide_not_visited, int fog_of_war);
void DrawPlayer(int x, int y, int pl_dir, int pl_frm);
int GetNearestCheckpoint(int x, int y);
int dist(int x1, int y1, int x2, int y2);
#define K_UP 0
#define K_DN 1
#define K_LT 2
#define K_RT 3
#define K_SP 4

#ifndef DATADIR
#define DATADIR "dat"
#endif

#endif
