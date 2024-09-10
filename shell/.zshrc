# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH
#
# I set this to get the auto complete logic working.
# However I ran into problems, so I just ended up
# symlinking the auto completer executable to /usr/local/bin
#export PATH=/usr/local/aws/bin/:$PATH
zmodload zsh/zprof

# Path to your oh-my-zsh installation.
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export ZSH="$HOME/.oh-my-zsh"

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time oh-my-zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes

# Set list of themes to pick from when loading at random
# Setting this variable when ZSH_THEME=random will cause zsh to load
# a theme from this variable instead of looking in $ZSH/themes/
# If set to an empty array, this variable will have no effect.
# ZSH_THEME_RANDOM_CANDIDATES=( "robbyrussell" "agnoster" )

# Uncomment the following line to use case-sensitive completion.
# CASE_SENSITIVE="true"

# Uncomment the following line to use hyphen-insensitive completion.
# Case-sensitive completion must be off. _ and - will be interchangeable.
# HYPHEN_INSENSITIVE="true"

# Uncomment one of the following lines to change the auto-update behavior
# zstyle ':omz:update' mode disabled  # disable automatic updates
# zstyle ':omz:update' mode auto      # update automatically without asking
# zstyle ':omz:update' mode reminder  # just remind me to update when it's time

# Uncomment the following line to change how often to auto-update (in days).
# zstyle ':omz:update' frequency 13

# Uncomment the following line if pasting URLs and other text is messed up.
# DISABLE_MAGIC_FUNCTIONS="true"

# Uncomment the following line to disable colors in ls.
# DISABLE_LS_COLORS="true"

# Uncomment the following line to disable auto-setting terminal title.
# DISABLE_AUTO_TITLE="true"

# Uncomment the following line to enable command auto-correction.
# ENABLE_CORRECTION="true"

# Uncomment the following line to display red dots whilst waiting for completion.
# You can also set it to another string to have that shown instead of the default red dots.
# e.g. COMPLETION_WAITING_DOTS="%F{yellow}waiting...%f"
# Caution: this setting can cause issues with multiline prompts in zsh < 5.7.1 (see #5765)
# COMPLETION_WAITING_DOTS="true"

# Uncomment the following line if you want to disable marking untracked files
# under VCS as dirty. This makes repository status check for large repositories
# much, much faster.
# DISABLE_UNTRACKED_FILES_DIRTY="true"

# Uncomment the following line if you want to change the command execution time
# stamp shown in the history command output.
# You can set one of the optional three formats:
# "mm/dd/yyyy"|"dd.mm.yyyy"|"yyyy-mm-dd"
# or set a custom format using the strftime function format specifications,
# see 'man strftime' for details.
# HIST_STAMPS="mm/dd/yyyy"

# Would you like to use another custom folder than $ZSH/custom?
# ZSH_CUSTOM=/path/to/new-custom-folder

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
#
# There are some that are installed w/ default ZSH
# See: https://github.com/ohmyzsh/ohmyzsh/wiki/Plugins
#
plugins=(git                         # preinstalled
         zsh-autosuggestions
         zsh-syntax-highlighting
         kube-ps1
       )

source "$ZSH/oh-my-zsh.sh"
set -o vi # set CLI to vim mode

# Apparently these lines help manage Node.js versions
# They take a while to run though so commenting them out
#
#if which brew >/dev/null; then
#    source $(brew --prefix nvm)/nvm.sh
#fi

# User configuration

# export MANPATH="/usr/local/man:$MANPATH"

# You may need to manually set your language environment
# export LANG=en_US.UTF-8

# Preferred editor for local and remote sessions
# if [[ -n $SSH_CONNECTION ]]; then
#   export EDITOR='vim'
# else
#   export EDITOR='mvim'
# fi

# Compilation flags
# export ARCHFLAGS="-arch x86_64"

# Set personal aliases, overriding those provided by oh-my-zsh libs,
# plugins, and themes. Aliases can be placed here, though oh-my-zsh
# users are encouraged to define aliases within the ZSH_CUSTOM folder.
# For a full list of active aliases, run `alias`.
#
# Example aliases
# alias zshconfig="mate ~/.zshrc"
# alias ohmyzsh="mate ~/.oh-my-zsh"

# environment variables
export NVM_DIR=~/.nvm
export TMUX_VERSION=3.3 # required for some esoteric commands in ~/.tmux.conf
export HISTSIZE=1000000 # https://unix.stackexchange.com/questions/273861/unlimited-history-in-zsh
export SAVEHIST=1000000 # https://unix.stackexchange.com/questions/273861/unlimited-history-in-zsh
export EDITOR=vi        # MITM proxy
export OS=$(sysctl -a | grep ostype | awk '{print $NF}')

# aliases
# rename_branch is symlinked to /Users/paulwendt/utils/bash/rename_branch.sh
# push_branch just exists in /usr/local/bin. Not sure why I made it there
alias activate='source .venv/bin/activate'
alias mark='m=$(pwd)'
alias vi='nvim'
alias pip='pip3'
alias current_branch="git rev-parse --abbrev-ref HEAD"
alias k="kubectl"
alias urldecode='python3 -c "import sys, urllib.parse as ul; \
    print(ul.unquote_plus(sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()))"'
alias urlencode='python -c "import sys, urllib as ul; \
    print(ul.quote_plus(sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()))"'
alias recentgit='history | grep "git checkout -b" | grep -v history | tail -n 10'
alias clear='echo "use ctrl + l instead"'
alias lineless_history="history | gsed 's/^[0-9]\+[\*]\?\s\+//g'"
alias memory_hogs="find . -type f -exec ls -lh {} + 2>/dev/null | sort -rh -k5 | head -n 10"
alias chrome="/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome"
alias tempdir="cd $(mktemp -d)"
alias ipython="ipython --TerminalInteractiveShell.editing_mode=vi"
alias serve='python -m http.server 8888'
#alias dockershell="docker run -e DISPLAY=$DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix --rm -i -t --entrypoint=/bin/bash" # https://blog.ropnop.com/docker-for-pentesters/
alias dockershell="docker run --rm -i -t --entrypoint=/bin/bash" # https://blog.ropnop.com/docker-for-pentesters/
alias dockershellsh="docker run --rm -i -t --entrypoint=/bin/sh" # https://blog.ropnop.com/docker-for-pentesters/

# autocomplete stuff for k8s
# See https://kubernetes.io/docs/tasks/tools/included/optional-kubectl-configs-zsh/
complete -F __start_kubectl k
source <(kubectl completion zsh)

# autocomplete stuff for aws cli
# See: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-completion.html
autoload bashcompinit && bashcompinit
autoload -Uz compinit && compinit
complete -C '/usr/local/bin/aws_completer' aws

# run a program behind mitmproxy
# this won't work with everything, but afaik it does work with:
#
#   - python
#   - curl
#   - wget
#   - aws
#
# reworked on 2/8/2024. i'm hoping to get more use out of this one now
function proxy() {
  # get mitmproxy PIDs
  # if there isn't a proxy running, exit
  proxy_pids=$(ps -x | grep mitmproxy | grep -v grep | awk '{print $1}')
  if [ -z $proxy_pids ]; then
    echo "no proxies running..."
    kill -INT $$
  fi

  # determine how many mitmproxy processes are running
  # if there's more than 1, bail out
  #
  # TODO: maybe at some point we want to make this selectable
  cnt_proxies=$(echo $proxy_pids | wc | awk '{print $1}')
  if [[ $cnt_proxies -gt 1 ]]; then
    echo "Too many proxies running ($cnt_proxies)"
    echo "$proxy_pids"
    kill -INT $$
  fi

  # figure out which port to use & spin up the appropriate command
  PORT=$(lsof -i -n -P -a -p $proxy_pids | grep -i listen | awk '{print $9}' | sed 's/^.*://g' | sort | uniq)
  if ! lsof -i -n -P | grep "$PORT" >/dev/null; then
    echo "Nothing listening on $PORT!"
  else
    echo "Running '${@:1}' using mitmproxy listening on port $PORT" >&2
    http_proxy=http://localhost:"$PORT" https_proxy=https://localhost:"$PORT" REQUESTS_CA_BUNDLE=/Users/paulwendt/.mitmproxy/mitmproxy-ca-cert.pem $@
  fi
}

# kill all processes matching some pattern
# I use this all the time to kill rogue dagster processes
function assassinate {
  if [ -z "$1" ]; then
    echo "Requires argument"
  fi

  ps -e | grep -i "$1" | grep -v grep | awk '{print $1}' | xargs -I {} /bin/sh -c "echo 'kill -9 {}' && kill -9 {}"
}


# generates a SQL conditional from a list of things
#
# ```bash
# $ echo "a\nb\nc\nd\ne" | sql_conditional
# ('a', 'b', 'c', 'd', 'e')
# ```
#
# i almost never use this in practice though
function sql_conditional {
  cat | sed "s/^/'/g" | sed "s/$/'/g" | tr '\n', ',' | sed 's/,$/)/g' | sed 's/^/(/g' | tee /dev/stderr | pbcopy
} </dev/stdin

# rerun a command
# this has proven surprisingly useful
function rerun() {
  num="$1"
  if [ -z "$1" ]; then
    echo "No argument supplied"
  else
    cmd=$(history | egrep "^\s*$num\*?\s+" | awk '{$1=""; print $0}')
    echo $cmd
    eval "$cmd"
  fi
}


function dockershellhere() {
    dirname=${PWD##*/}
    docker run --rm -it --entrypoint=/bin/bash -v `pwd`:/${dirname} -w /${dirname} "$@"
}
function dockershellshhere() {
    dirname=${PWD##*/}
    docker run --rm -it --entrypoint=/bin/sh -v `pwd`:/${dirname} -w /${dirname} "$@"
}

for file in .zshrc-sensitive .zshrc-data-platform .zshrc-gpt .zsh-digraphs.sh; do
  if test -f ~/$file; then
    source ~/$file
  else
    echo ".zshrc: ~/$file does not exist (not sourcing)" >&2
  fi
done

# this was intended for getting X11 forwarding to a docker container working
# disabling for now...
#xhost +local:docker >/dev/null
#
if [[ "$OS" == "Linux" ]] then;
  # we should make sure xclip is installed here
  alias pbcopy="xclip -selection clipboard"
  alias pbpaste="xclip -selection clipboard -o"
fi

function execpod() {
  # this is a dumb approach for figuring out which column the
  # pods name are in
  firstCol=$(kubectl get pods $@ | head -n 1 | awk '{print $1}')
  if [[ "$firstCol" == "NAMESPACE" ]]; then
    nameIndex=2
  else
    nameIndex=1
  fi

  podName=$(kubectl get pods $@ | fzf | awk "{print \$$nameIndex}")
  if [[ $podName == "NAME" ]] || [[ $podName == "NAMESPACE" ]]; then
    echo "Invalid selection"
    exit 1
  fi

  # because namespace isn't a required argument, we need to do another
  # lookup to see which namespace the selected pod is in
  namespace=$(kubectl get pods $@ -o json | jq -r ".items[] | select(.metadata.name == \"$podName\") | .metadata.namespace")

  # (attempt to) exec in
  echo "kubectl exec $podName -n $namespace -it -- /bin/bash"
  kubectl exec $podName -n $namespace -it -- /bin/bash
}

# screws with command history scroll
#eval "$(atuin init zsh)"
#
function document() {
  echo '```bash'
  echo "> $*"
  "$@"
  echo '```'
}

alias screenshot='echo ~/Desktop/"$(ls -t1 ~/Desktop/ | head -n 1)"'

# for local database management
mkdir -p /usr/local/share/databases/backup
mkdir -p /usr/local/share/databases/live

# ~/.zshrc profiling
# comment back in if shell startup is slow and you want to see why
#zprof
#
