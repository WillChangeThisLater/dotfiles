#
# ~/.bashrc
#

# If not running interactively, don't do anything
[[ $- != *i* ]] && return

alias ls='ls --color=auto'
alias grep='grep --color=auto'

PS1='[\u@\h \W]\$ '

# vim mode
# this is causing problems with ctrl+l
set -o vi

alias vi='nvim'

# fill these in...
export OPENAI_API_KEY=""
export GROQ_API_KEY=""
export NGROK_AUTHTOKEN=""
export HUGGING_FACE_API_KEY=""

#alias pbcopy='xclip -selection clipboard'
#alias pbpaste='xclip -selection clipboard -o'
alias pbcopy=wl-copy
alias pbpaste=wl-paste

# GPT related
#alias summary='pbpaste | ask_gpt --message "Summarize the following: "'
#alias debug='pbpaste | ask_gpt --message "Explain how to debug the following error step by step. Be simple and clear: "'
#alias fix='pbpaste | ask_gpt --message "Fix this: "'

#debug() {
#    echo "yo"
#    #numLines=250
#    #tmux capture-pane -S -250 | tmux save-buffer - | ask_gpt --message "Describe how to debug the following. Use simple, easy to follow steps and clear language."
#}

debug() {
  numLines=20
  tmux capture-pane -pS -"$numLines" > /tmp/screenshot.txt
  cat <<EOF
Debugging. It might take 10-15 seconds for a response to appear
If you think the prompt is wrong check /tmp/prompt.txt"
If you want to change the prompt check ~/.bashrc

EOF

  cat << EOF > /tmp/prompt.txt
Output from a terminal session is below.
I'd like you to help debug it

Step by step, walk through how to debug the most recent
error in the terminal session.
Be simple. Use clear language. Be concise. Provide commands
the user can run to debug and fix the error if you can.

Focus on the last error in the session. Mention relevant errors
from earlier in the session only if they are relevant.

If you think there are no errors, explain why you think that.

Some times the error might not be obvious, and you will
have to use reasoning to figure out what the confusion is.
For instance, although the bash output below has no explicit
errors, it is clear from the context that the user is confused
why the pgrep command for a PID returns no results, while a
combination of 'ps -a' and grep indicates the PID exists.

\`\`\`bash
[arch@archlinux link-embedder]$ pgrep 1757501
[arch@archlinux link-embedder]$ ps -a | grep 1757501
1757501 pts/11   00:00:00 sleep
\`\`\`

Just to reiterate: only focus on THE MOST RECENT error. 
For instance, if you see a session like this

\`\`\`bash
[arch@archlinux tmp]$ l
-bash: l: command not found
[arch@archlinux tmp]$ cat /var/sock/d
cat: /var/sock/d: No such file or directory
\`\`\`

ONLY focus on the most recent error (cat: /var/sock/d: No such file or directory)
Do NOT comment on the '-bash: l: command not found' error UNLESS it relates
to the (cat: /var/sock/d: No such file or directory) error in some way.

\`\`\`bash
$(cat /tmp/screenshot.txt)
\`\`\`
EOF

cat /tmp/prompt.txt | ask_gpt
}


# pyenv install stuff
export PYENV_ROOT="$HOME/.pyenv"
command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"

# activate the pyenv-virtualenv manager
eval "$(pyenv virtualenv-init -)"

if [ -z "$SSH_AUTH_SOCK" ] ; then
  eval `ssh-agent -s` >/dev/null 2>&1
  ssh-add ~/.ssh/github >/dev/null 2>&1
fi

# activate a virtual env so we can pip install stuff
# pyenv activate bash # i think the eval should activate for us
alias repocat='files-to-prompt'

signalInfo() {
    echo ""
    man 7 signal | less -N | sed -n '213,253p' | sed 's/^[[:space:]]\+//g'
    echo ""
}

alias google-chrome="/opt/google/chrome/google-chrome"
function gowitness() {
  /home/arch/go/bin/gowitness "$@" #--db-location sqlite:///home/arch/gowitness-screenshots/database.db
}
export SCREENSHOTDB="sqlite:///home/arch/site-screenshot/database/screenshots.db"

# the next ask_gpt
alias lm="/home/arch/scripts/go-llm/go-llm"
alias tunnel="curl -s localhost:4040/api/tunnels | jq -r '.tunnels.[].public_url'"

# uv
export PATH="/home/arch/.local/bin:$PATH"

