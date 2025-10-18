// Learn more about clients at https://docs.boundaryml.com/docs/snippets/clients/overview

client<llm> AegisGPTo4mini {
  provider openai
  options {
    model "o4-mini"
    api_key env.OPENAI_API_KEY
    }
}

client<llm> AegisGPT41Creative {
  provider openai
  options {
    model "gpt-4.1"
    api_key env.OPENAI_API_KEY
    temperature 0.6
  }
}

client<llm> AegisSonnet37Creative {
  provider anthropic
  options {
    model "claude-3-7-sonnet-20250219"
    api_key env.ANTHROPIC_API_KEY
    temperature 0.6
  }
}


client<llm> AegisGPT41 {
  provider openai
  options {
    model "gpt-4.1"
    api_key env.OPENAI_API_KEY
    temperature 0.0
  }
}

client<llm> AegisSonnet37 {
  provider anthropic
  options {
    model "claude-3-7-sonnet-20250219"
    api_key env.ANTHROPIC_API_KEY
    temperature 0.0
  }
}


// https://docs.boundaryml.com/docs/snippets/clients/fallback
client<llm> AegisFallback {
  provider fallback
  retry_policy Exponential
  options {
    // This will try the clients in order until one succeeds
    strategy [AegisGPT41, AegisSonnet37]
  }
}

// https://docs.boundaryml.com/docs/snippets/clients/retry
retry_policy Constant {
  max_retries 3
  // Strategy is optional
  strategy {
    type constant_delay
    delay_ms 200
  }
}

retry_policy Exponential {
  max_retries 2
  // Strategy is optional
  strategy {
    type exponential_backoff
    delay_ms 300
    multiplier 1.5
    max_delay_ms 10000
  }
}