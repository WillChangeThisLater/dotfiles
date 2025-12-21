:set number
:set ruler
:set backspace=indent,eol,start
:set history=100

map <F5> <Esc>:w<CR>:!clear;lua %<CR>
map <F6> <Esc>:w<CR>:!clear;python3 %<CR>
map <F7> <Esc>:w<CR>:!clear;pytest %<CR>
vnoremap r :!dedent <bar> python3<CR>
vnoremap p :!dedent <bar> pysend<CR>
vnoremap < <gv
vnoremap > >gv

inoremap <C-a> ä
:set tabstop=4
:set shiftwidth=4
