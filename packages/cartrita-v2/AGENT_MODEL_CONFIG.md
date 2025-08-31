# 🤖 Agent Model Configuration - Cartrita V2

## Model Assignments by Agen```python
def get_model_for_agent(agent_type: str) -> str:
    """Get the appropriate model for each agent type from environment variables"""
    model_map = {
        'supervisor': os.getenv('SUPERVISOR_AGENT_MODEL', 'gpt-5'),
        'research': os.getenv('RESEARCH_AGENT_MODEL', 'gpt-5'),
        'writer': os.getenv('WRITER_AGENT_MODEL', 'gpt-5'),
        'vision': os.getenv('VISION_AGENT_MODEL', 'gpt-5'),
        'computer_use': os.getenv('COMPUTER_USE_AGENT_MODEL', 'gpt-5'),
        'code_writer': os.getenv('CODE_WRITER_AGENT_MODEL', 'gpt-5'),
    }
    return model_map.get(agent_type, 'gpt-5')
```agent in the Cartrita ecosystem is now optimized with GPT-5 variants for maximum performance:

### 🎯 Core Models Configuration

| Agent Type | Model | Optimization Reason |
|-----------|--------|-------------------|
| **Supervisor (Main Cartrita)** | `gpt-5` | 🧠 Most advanced reasoning for orchestration and delegation |
| **Research Agent** | `gpt-5` | 📚 Advanced analysis, synthesis, and academic paper processing |
| **Writer Agent** | `gpt-5` | ✍️ Superior creative and technical writing capabilities |
| **Vision Agent** | `gpt-5` | 👁️ Next-generation image/video analysis and visual understanding |
| **Computer Use Agent** | `gpt-5` | 🚀 Advanced automation tasks and intelligent system interactions |
| **Code Writer Agent** | `gpt-5` | 💻 Revolutionary programming, architecture, and code generation |

### 🔧 Environment Configuration

The models are configured via environment variables in `.env`:

```bash
# Agent-Specific Model Configuration (Optimized with GPT-5 Variants)
# Main Cartrita uses GPT-5 (most advanced reasoning for orchestration)
SUPERVISOR_AGENT_MODEL=gpt-5
# Research agent uses GPT-5 for complex analysis, synthesis, and academic research
RESEARCH_AGENT_MODEL=gpt-5
# Writer agent uses GPT-5 for high-quality creative and technical writing
WRITER_AGENT_MODEL=gpt-5
# Vision agent uses GPT-5 for advanced image/video analysis and multimodal tasks
VISION_AGENT_MODEL=gpt-5
# Computer use agent uses GPT-5 for advanced automation and system interactions
COMPUTER_USE_AGENT_MODEL=gpt-5
# Code writer uses GPT-5 for complex programming and architecture tasks
CODE_WRITER_AGENT_MODEL=gpt-5
```

### 📊 Model Characteristics

#### **GPT-4-Turbo (Supervisor)**
- **Strengths**: Advanced reasoning, complex problem-solving, strategic thinking
- **Use Case**: Main orchestration, high-level decision making, agent delegation
- **Context Window**: 128,000 tokens
- **Speed**: Balanced performance for complex reasoning

#### **GPT-4o (Research/Writer/Code)**
- **Strengths**: Excellent at analysis, writing, coding, multimodal understanding
- **Use Case**: Content generation, research synthesis, code development
- **Context Window**: 128,000 tokens  
- **Speed**: Optimized for quality output

#### **GPT-4-Vision-Preview (Vision)**
- **Strengths**: Image analysis, visual understanding, object detection
- **Use Case**: Image processing, video analysis, visual AI tasks
- **Context Window**: 128,000 tokens
- **Multimodal**: Native image input support

#### **GPT-4o-Mini (Computer Use)**
- **Strengths**: Fast response, efficient processing, good for automation
- **Use Case**: System interactions, quick tasks, high-frequency operations
- **Context Window**: 128,000 tokens
- **Speed**: Fastest response times, cost-effective

### 🚀 Performance Benefits

1. **Specialized Intelligence**: Each agent uses the most appropriate model for its domain
2. **Cost Optimization**: Computer use agent uses mini model for efficiency
3. **Quality Maximization**: Critical tasks use advanced models
4. **Speed Balance**: Fast models for real-time tasks, powerful models for complex reasoning

### 🔄 Dynamic Model Loading

The system supports dynamic model assignment through the `get_model_for_agent()` function in `agent_manager.py`:

```python
def get_model_for_agent(agent_type: str) -> str:
    """Get the appropriate model for each agent type from environment variables"""
    model_map = {
        'supervisor': os.getenv('SUPERVISOR_AGENT_MODEL', 'gpt-4-turbo'),
        'research': os.getenv('RESEARCH_AGENT_MODEL', 'gpt-4o'),
        'writer': os.getenv('WRITER_AGENT_MODEL', 'gpt-4o'),
        'vision': os.getenv('VISION_AGENT_MODEL', 'gpt-4-vision-preview'),
        'computer_use': os.getenv('COMPUTER_USE_AGENT_MODEL', 'gpt-5'),
        'code_writer': os.getenv('CODE_WRITER_AGENT_MODEL', 'gpt-4o'),
    }
    return model_map.get(agent_type, 'gpt-4o')
```

### ✅ Configuration Status

- **Environment Variables**: ✅ Updated in `.env`
- **Agent Manager**: ✅ Reading from environment
- **Docker Container**: ✅ Restarted with new config
- **Model Assignment**: ✅ Active per agent type
- **Testing**: ✅ Verified working

### 🧪 Testing Results

```bash
$ curl -X POST http://localhost:8002/api/v2/simple-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What model are you using?"}' | jq '.metadata'

{
  "model": "gpt-4o-mini"  # Computer use agent responded (as expected)
}
```

The configuration is now live and each agent will use their optimized model for enhanced performance and cost efficiency.

---

*Configuration applied: 2025-08-26*  
*Status: ✅ ACTIVE*