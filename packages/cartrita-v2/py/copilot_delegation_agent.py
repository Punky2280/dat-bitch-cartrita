"""
Cartrita V2 - GitHub Copilot Delegation Agent
Specialized agent for researching project docs and delegating tasks to GitHub Copilot
"""

import asyncio
import time
import os
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from openai import AsyncOpenAI

# GUI dependencies - import conditionally
try:
    import pyautogui
    from PIL import Image
    import cv2
    import numpy as np
    GUI_AVAILABLE = True
    print("✅ GUI dependencies loaded successfully")
except ImportError as e:
    print(f"⚠️ GUI dependencies not available: {e}")
    GUI_AVAILABLE = False

class GitHubCopilotDelegationAgent:
    """
    Advanced agent that:
    1. Takes control of mouse and keyboard
    2. Researches project documentation
    3. Analyzes codebase structure
    4. Delegates tasks to GitHub Copilot as if it were the user
    """
    
    def __init__(self, openai_api_key: str = None, headless: bool = False):
        self.client = AsyncOpenAI(api_key=openai_api_key)
        self.is_active = False
        self.project_analysis = {}
        self.gui_enabled = GUI_AVAILABLE and not headless
        
        # Mouse and keyboard control settings (only if GUI available)
        if self.gui_enabled:
            pyautogui.FAILSAFE = True  # Move mouse to top-left to stop
            pyautogui.PAUSE = 0.5      # Pause between actions
            print("🖱️ GUI automation enabled")
        else:
            print("🔧 Running in headless/simulation mode")
        
        # Screenshot storage
        self.screenshot_dir = Path("/tmp/cartrita_copilot_sessions")
        self.screenshot_dir.mkdir(exist_ok=True)
        
        # Project analysis storage
        self.analysis_results = {
            "project_structure": {},
            "documentation_summary": "",
            "key_files": [],
            "technologies_used": [],
            "copilot_tasks": []
        }
    
    async def start_delegation_session(self, project_path: str, task_description: str):
        """Start a comprehensive delegation session"""
        print("🚀 Starting GitHub Copilot Delegation Session")
        print(f"📁 Project: {project_path}")
        print(f"🎯 Task: {task_description}")
        print("-" * 60)
        
        self.is_active = True
        session_id = f"copilot_session_{int(time.time())}"
        
        try:
            # Phase 0: Read Copilot Instructions (if available)
            copilot_procedures = await self.read_copilot_instructions(project_path)
            
            # Phase 1: Project Research
            await self.research_project_documentation(project_path)
            
            # Phase 2: Codebase Analysis
            await self.analyze_codebase_structure(project_path)
            
            # Phase 3: Task Planning (incorporating copilot procedures)
            delegation_plan = await self.create_delegation_plan(task_description, copilot_procedures)
            
            # Phase 4: Interactive Copilot Delegation
            await self.execute_copilot_delegation(delegation_plan)
            
            # Phase 5: Monitoring and Follow-up
            await self.monitor_copilot_progress()
            
            return {
                "session_id": session_id,
                "success": True,
                "analysis": self.analysis_results,
                "delegation_plan": delegation_plan,
                "copilot_procedures": copilot_procedures
            }
            
        except Exception as e:
            print(f"❌ Session failed: {e}")
            return {"session_id": session_id, "success": False, "error": str(e)}
        
        finally:
            self.is_active = False
    
    async def read_copilot_instructions(self, project_path: str) -> Dict:
        """Phase 0: Read and parse copilot-instructions.md if it exists"""
        print("📋 Phase 0: Reading Copilot Instructions")
        
        copilot_instructions_path = Path(project_path) / "copilot-instructions.md"
        
        if copilot_instructions_path.exists():
            print(f"✅ Found copilot instructions: {copilot_instructions_path}")
            
            try:
                with open(copilot_instructions_path, 'r', encoding='utf-8') as f:
                    instructions_content = f.read()
                
                # Parse instructions with AI
                parsed_instructions = await self.parse_copilot_instructions_with_ai(instructions_content)
                
                print("📚 Copilot instructions loaded and parsed")
                return parsed_instructions
                
            except Exception as e:
                print(f"⚠️ Could not read copilot instructions: {e}")
                return self.get_default_copilot_procedures()
        else:
            print("📝 No copilot-instructions.md found, creating template...")
            await self.create_copilot_instructions_template(copilot_instructions_path)
            return self.get_default_copilot_procedures()
    
    async def research_project_documentation(self, project_path: str):
        """Phase 1: Research all project documentation"""
        print("📚 Phase 1: Researching Project Documentation")
        
        # Take initial screenshot
        initial_screenshot = self.take_screenshot("initial_state")
        
        # Find and read documentation files
        doc_files = self.find_documentation_files(project_path)
        
        print(f"📄 Found {len(doc_files)} documentation files")
        
        documentation_content = ""
        for doc_file in doc_files:
            print(f"   Reading: {doc_file}")
            try:
                with open(doc_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    documentation_content += f"\n\n## {doc_file}\n{content}"
            except Exception as e:
                print(f"   ⚠️ Could not read {doc_file}: {e}")
        
        # Analyze documentation with AI
        if documentation_content:
            analysis = await self.analyze_documentation_with_ai(documentation_content)
            self.analysis_results["documentation_summary"] = analysis
        
        print("✅ Documentation research completed")
    
    async def analyze_codebase_structure(self, project_path: str):
        """Phase 2: Analyze codebase structure and key files"""
        print("🔍 Phase 2: Analyzing Codebase Structure")
        
        # Get project structure
        structure = self.get_project_structure(project_path)
        self.analysis_results["project_structure"] = structure
        
        # Identify key files
        key_files = self.identify_key_files(project_path)
        self.analysis_results["key_files"] = key_files
        
        # Detect technologies
        technologies = self.detect_technologies(project_path)
        self.analysis_results["technologies_used"] = technologies
        
        print(f"📁 Project structure mapped: {len(structure)} directories")
        print(f"🔑 Key files identified: {len(key_files)}")
        print(f"⚙️ Technologies detected: {', '.join(technologies)}")
        
        print("✅ Codebase analysis completed")
    
    async def create_delegation_plan(self, task_description: str, copilot_procedures: Dict = None):
        """Phase 3: Create intelligent delegation plan for Copilot"""
        print("🎯 Phase 3: Creating Delegation Plan")
        
        # Analyze task with project context
        context = {
            "task": task_description,
            "project_structure": self.analysis_results["project_structure"],
            "documentation": self.analysis_results["documentation_summary"],
            "key_files": self.analysis_results["key_files"],
            "technologies": self.analysis_results["technologies_used"],
            "copilot_procedures": copilot_procedures or {}
        }
        
        # Generate delegation strategy with AI
        delegation_plan = await self.generate_delegation_strategy(context)
        
        print("📋 Delegation plan created:")
        for i, step in enumerate(delegation_plan.get("steps", []), 1):
            print(f"   {i}. {step['action']} - {step['description']}")
        
        print("✅ Delegation planning completed")
        return delegation_plan
    
    async def execute_copilot_delegation(self, delegation_plan: Dict):
        """Phase 4: Execute delegation by controlling mouse/keyboard"""
        print("🖱️ Phase 4: Executing Copilot Delegation")
        
        for i, step in enumerate(delegation_plan.get("steps", []), 1):
            print(f"\n🔄 Executing Step {i}: {step['action']}")
            
            try:
                if step["action"] == "open_file":
                    await self.open_file_in_vscode(step["file_path"])
                
                elif step["action"] == "trigger_copilot":
                    await self.trigger_copilot_suggestion(step["prompt"])
                
                elif step["action"] == "accept_suggestion":
                    await self.accept_copilot_suggestion()
                
                elif step["action"] == "navigate_to_function":
                    await self.navigate_to_code_location(step["location"])
                
                elif step["action"] == "create_comment":
                    await self.create_copilot_comment(step["comment"])
                
                elif step["action"] == "run_tests":
                    await self.run_tests_via_terminal()
                
                # Take screenshot after each major action
                self.take_screenshot(f"step_{i}_{step['action']}")
                
                # Brief pause between actions
                await asyncio.sleep(1)
                
            except Exception as e:
                print(f"   ⚠️ Step {i} failed: {e}")
                continue
        
        print("✅ Delegation execution completed")
    
    async def monitor_copilot_progress(self):
        """Phase 5: Monitor Copilot suggestions and progress"""
        print("👁️ Phase 5: Monitoring Copilot Progress")
        
        # Take final screenshot
        final_screenshot = self.take_screenshot("final_state")
        
        # Check for any visible Copilot suggestions
        copilot_suggestions = await self.detect_copilot_suggestions()
        
        if copilot_suggestions:
            print(f"💡 Found {len(copilot_suggestions)} Copilot suggestions")
            for suggestion in copilot_suggestions:
                print(f"   • {suggestion}")
        
        print("✅ Monitoring completed")
    
    # Mouse and Keyboard Control Methods
    
    async def open_file_in_vscode(self, file_path: str):
        """Open a file in VS Code using keyboard shortcuts"""
        print(f"📂 Opening file: {file_path}")
        
        if self.gui_enabled:
            # Use Ctrl+P to open quick file search
            pyautogui.hotkey('ctrl', 'p')
            await asyncio.sleep(0.5)
            
            # Type the file path
            pyautogui.typewrite(file_path)
            await asyncio.sleep(0.5)
            
            # Press Enter to open
            pyautogui.press('enter')
            await asyncio.sleep(1)
        else:
            print("   🔧 Simulation: Would open file in VS Code")
    
    async def trigger_copilot_suggestion(self, prompt: str):
        """Trigger Copilot suggestion by writing a comment"""
        print(f"💭 Triggering Copilot with: {prompt}")
        
        if self.gui_enabled:
            # Add comment to trigger Copilot
            pyautogui.typewrite(f"// {prompt}")
            pyautogui.press('enter')
            
            # Wait for Copilot suggestion
            await asyncio.sleep(2)
        else:
            print("   🔧 Simulation: Would trigger Copilot suggestion")
    
    async def accept_copilot_suggestion(self):
        """Accept Copilot suggestion using Tab key"""
        print("✅ Accepting Copilot suggestion")
        
        if self.gui_enabled:
            pyautogui.press('tab')
            await asyncio.sleep(0.5)
        else:
            print("   🔧 Simulation: Would accept Copilot suggestion")
    
    async def navigate_to_code_location(self, location: str):
        """Navigate to specific code location using Ctrl+G"""
        print(f"🧭 Navigating to: {location}")
        
        # Use Ctrl+G for "Go to Line"
        pyautogui.hotkey('ctrl', 'g')
        await asyncio.sleep(0.5)
        
        pyautogui.typewrite(location)
        pyautogui.press('enter')
        await asyncio.sleep(0.5)
    
    async def create_copilot_comment(self, comment: str):
        """Create a comment to guide Copilot"""
        print(f"💬 Creating comment: {comment}")
        
        pyautogui.typewrite(f"// {comment}")
        pyautogui.press('enter')
        await asyncio.sleep(1)
    
    async def run_tests_via_terminal(self):
        """Run tests using terminal"""
        print("🧪 Running tests")
        
        # Open terminal with Ctrl+` (backtick)
        pyautogui.hotkey('ctrl', '`')
        await asyncio.sleep(1)
        
        # Run npm test or pytest depending on project
        if "javascript" in self.analysis_results.get("technologies_used", []):
            pyautogui.typewrite("npm test")
        elif "python" in self.analysis_results.get("technologies_used", []):
            pyautogui.typewrite("pytest")
        else:
            pyautogui.typewrite("echo 'No test command detected'")
        
        pyautogui.press('enter')
        await asyncio.sleep(3)
    
    # Analysis and Detection Methods
    
    def find_documentation_files(self, project_path: str) -> List[str]:
        """Find all documentation files in the project"""
        doc_patterns = ['README*', 'CHANGELOG*', 'CONTRIBUTING*', 'LICENSE*', 'DOCS*', '*.md', '*.rst', '*.txt']
        doc_files = []
        
        project_dir = Path(project_path)
        for pattern in doc_patterns:
            doc_files.extend(project_dir.glob(f"**/{pattern}"))
        
        return [str(f) for f in doc_files if f.is_file()][:20]  # Limit to 20 files
    
    def get_project_structure(self, project_path: str) -> Dict:
        """Get project directory structure"""
        structure = {}
        project_dir = Path(project_path)
        
        for item in project_dir.rglob("*"):
            if item.is_dir() and not any(skip in item.name for skip in ['.git', 'node_modules', '__pycache__', '.venv']):
                rel_path = item.relative_to(project_dir)
                structure[str(rel_path)] = "directory"
        
        return structure
    
    def identify_key_files(self, project_path: str) -> List[str]:
        """Identify key files in the project"""
        key_patterns = [
            'package.json', 'requirements.txt', 'Dockerfile', 'docker-compose.yml',
            'main.py', 'index.js', 'app.py', 'server.js', 'tsconfig.json',
            'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle'
        ]
        
        key_files = []
        project_dir = Path(project_path)
        
        for pattern in key_patterns:
            found_files = list(project_dir.glob(f"**/{pattern}"))
            key_files.extend([str(f) for f in found_files])
        
        return key_files[:10]  # Limit to 10 key files
    
    def detect_technologies(self, project_path: str) -> List[str]:
        """Detect technologies used in the project"""
        technologies = []
        project_dir = Path(project_path)
        
        # Check for specific files/patterns
        if (project_dir / "package.json").exists():
            technologies.append("javascript")
        if (project_dir / "requirements.txt").exists():
            technologies.append("python")
        if (project_dir / "Cargo.toml").exists():
            technologies.append("rust")
        if (project_dir / "go.mod").exists():
            technologies.append("go")
        if list(project_dir.glob("**/*.java")):
            technologies.append("java")
        if list(project_dir.glob("**/*.tsx")) or list(project_dir.glob("**/*.jsx")):
            technologies.append("react")
        if (project_dir / "Dockerfile").exists():
            technologies.append("docker")
        
        return technologies
    
    async def detect_copilot_suggestions(self) -> List[str]:
        """Detect visible Copilot suggestions on screen"""
        # This would use computer vision to detect Copilot UI elements
        # For now, return mock suggestions
        return [
            "Function implementation suggestion visible",
            "Code completion suggestion available",
            "Comment-based suggestion ready"
        ]
    
    def take_screenshot(self, step_name: str) -> str:
        """Take screenshot and save it"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = self.screenshot_dir / f"{step_name}_{timestamp}.png"
        
        if self.gui_enabled:
            try:
                screenshot = pyautogui.screenshot()
                screenshot.save(screenshot_path)
                print(f"📸 Screenshot saved: {screenshot_path}")
                return str(screenshot_path)
            except Exception as e:
                print(f"⚠️ Screenshot failed: {e}")
                return ""
        else:
            print(f"📸 Simulation: Would take screenshot {step_name}")
            return str(screenshot_path)
    
    # AI Analysis Methods
    
    async def analyze_documentation_with_ai(self, documentation_content: str) -> str:
        """Analyze documentation using OpenAI"""
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert code analyst. Summarize project documentation concisely."},
                    {"role": "user", "content": f"Analyze this project documentation and provide a concise summary:\n\n{documentation_content[:8000]}"}
                ],
                max_tokens=500
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"⚠️ AI analysis failed: {e}")
            return "Documentation analysis unavailable"
    
    async def generate_delegation_strategy(self, context: Dict) -> Dict:
        """Generate delegation strategy using AI"""
        try:
            # Include copilot procedures in the prompt
            copilot_procedures_text = ""
            if context.get('copilot_procedures'):
                procedures = context['copilot_procedures']
                copilot_procedures_text = f"""
                
            Copilot Procedures to Follow:
            Workflow: {procedures.get('workflow', 'standard')}
            Preferences: {procedures.get('preferences', {})}
            
            Follow these phases from the copilot instructions:
            """
                for step in procedures.get('steps', []):
                    copilot_procedures_text += f"\n- {step.get('phase', 'unknown')}: {', '.join(step.get('actions', []))}"
            
            prompt = f"""
            Based on this project context, create a step-by-step delegation plan for GitHub Copilot:
            
            Task: {context['task']}
            Technologies: {', '.join(context['technologies'])}
            Key Files: {', '.join(context['key_files'][:5])}
            {copilot_procedures_text}
            
            Provide a JSON response with steps that include:
            - action: type of action to take
            - description: what this step accomplishes
            - file_path: relevant file (if applicable)
            - prompt: Copilot prompt (if applicable)
            - phase: which phase this belongs to (preparation/delegation/execution/validation)
            """
            
            response = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert at delegating tasks to GitHub Copilot. Return valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000
            )
            
            # Parse JSON response
            strategy_text = response.choices[0].message.content
            # Extract JSON from response if wrapped in markdown
            if "```json" in strategy_text:
                strategy_text = strategy_text.split("```json")[1].split("```")[0]
            
            return json.loads(strategy_text)
            
        except Exception as e:
            print(f"⚠️ Strategy generation failed: {e}")
            # Return fallback strategy
            return {
                "steps": [
                    {"action": "open_file", "description": "Open main project file", "file_path": "src/index.js"},
                    {"action": "trigger_copilot", "description": "Request code assistance", "prompt": context['task']},
                    {"action": "accept_suggestion", "description": "Accept Copilot suggestion"},
                    {"action": "run_tests", "description": "Run project tests"}
                ]
            }
    
    async def parse_copilot_instructions_with_ai(self, instructions_content: str) -> Dict:
        """Parse copilot instructions using OpenAI"""
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert at parsing GitHub Copilot delegation instructions. Extract procedures, workflows, and specific steps from the instructions and return structured JSON."},
                    {"role": "user", "content": f"Parse these copilot delegation instructions and return a structured format:\\n\\n{instructions_content}"}
                ],
                max_tokens=1000
            )
            
            # Parse JSON response
            instructions_text = response.choices[0].message.content
            if "```json" in instructions_text:
                instructions_text = instructions_text.split("```json")[1].split("```")[0]
            
            return json.loads(instructions_text)
            
        except Exception as e:
            print(f"⚠️ AI parsing failed: {e}")
            return self.get_default_copilot_procedures()
    
    def get_default_copilot_procedures(self) -> Dict:
        """Get default copilot delegation procedures"""
        return {
            "workflow": "standard",
            "steps": [
                {
                    "phase": "preparation",
                    "actions": ["analyze_project", "identify_key_files", "understand_task"]
                },
                {
                    "phase": "delegation", 
                    "actions": ["open_relevant_files", "create_descriptive_comments", "trigger_copilot_suggestions"]
                },
                {
                    "phase": "execution",
                    "actions": ["review_suggestions", "accept_appropriate_code", "test_implementations"]
                },
                {
                    "phase": "validation",
                    "actions": ["run_tests", "verify_functionality", "document_changes"]
                }
            ],
            "preferences": {
                "code_style": "follow_existing_patterns",
                "testing": "always_include_tests",
                "documentation": "comprehensive_comments",
                "review_process": "careful_manual_review"
            }
        }
    
    async def create_copilot_instructions_template(self, instructions_path: Path):
        """Create a template copilot-instructions.md file"""
        template_content = """# GitHub Copilot Delegation Instructions

This file contains procedures for the Cartrita GitHub Copilot delegation agent.

## Workflow Overview

The delegation agent follows these phases:
1. **Preparation**: Analyze project structure and understand the task
2. **Delegation**: Open relevant files and create context for Copilot
3. **Execution**: Review and accept appropriate Copilot suggestions
4. **Validation**: Test and verify the implemented changes

## Standard Procedures

### File Analysis
- Examine project structure and identify key files
- Read documentation and understand coding patterns
- Analyze existing code style and conventions

### Copilot Interaction
- Open files in logical order based on dependencies
- Create descriptive comments to guide Copilot suggestions
- Use specific prompts that align with project patterns
- Review suggestions carefully before acceptance

### Quality Assurance
- Run tests after making changes
- Verify functionality matches requirements
- Ensure code follows project conventions
- Document any significant changes

## Task-Specific Guidelines

### Code Generation
- Always include comprehensive error handling
- Follow existing naming conventions
- Add appropriate documentation/comments
- Include unit tests for new functionality

### Bug Fixes
- Identify root cause before implementing fix
- Test both the fix and edge cases
- Update related documentation if needed

### Refactoring
- Maintain backward compatibility unless explicitly requested
- Update all related tests
- Preserve existing functionality

## AI Assistant Preferences

- **Code Style**: Follow existing project patterns
- **Testing**: Always include tests for new code
- **Documentation**: Add comprehensive comments
- **Review**: Manual review of all suggestions before acceptance

## Custom Commands

Add any project-specific Copilot commands or shortcuts here.

## Notes

This template was auto-generated by the Cartrita delegation agent.
Customize these procedures based on your project's specific needs.
"""
        
        try:
            with open(instructions_path, 'w', encoding='utf-8') as f:
                f.write(template_content)
            print(f"📝 Created copilot instructions template: {instructions_path}")
        except Exception as e:
            print(f"⚠️ Could not create instructions template: {e}")

# Example usage and testing
async def main():
    """Test the Copilot delegation agent"""
    agent = GitHubCopilotDelegationAgent()
    
    # Example delegation session
    result = await agent.start_delegation_session(
        project_path="/home/robbie/development/dat-bitch-cartrita/packages/cartrita-v2",
        task_description="Add error handling and logging to the FastAPI endpoints"
    )
    
    print("\n🎯 DELEGATION SESSION COMPLETE")
    print(f"Success: {result['success']}")
    if result['success']:
        print(f"Analysis: {json.dumps(result['analysis'], indent=2)}")

if __name__ == "__main__":
    asyncio.run(main())