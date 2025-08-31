#!/usr/bin/env python3
"""
Headless GitHub Copilot Delegation Agent
Version that can run without X11/GUI dependencies for testing
"""

import asyncio
import os
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from openai import AsyncOpenAI

class HeadlessGitHubCopilotDelegationAgent:
    """
    Headless version of the GitHub Copilot delegation agent.
    Focuses on documentation analysis, task planning, and procedure following
    without requiring GUI automation capabilities.
    """
    
    def __init__(self, openai_api_key: str = None):
        self.client = AsyncOpenAI(api_key=openai_api_key) if openai_api_key else None
        self.is_active = False
        self.project_analysis = {}
        
        # Analysis results storage
        self.analysis_results = {
            "project_structure": {},
            "documentation_summary": "",
            "key_files": [],
            "technologies_used": [],
            "copilot_tasks": []
        }
        
        # Mock screenshot directory
        self.screenshot_dir = Path("/tmp/cartrita_copilot_sessions")
        self.screenshot_dir.mkdir(exist_ok=True)
    
    async def start_delegation_session(self, project_path: str, task_description: str):
        """Start a comprehensive delegation session (headless mode)"""
        print("🚀 Starting GitHub Copilot Delegation Session (Headless Mode)")
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
            
            # Phase 4: Simulation of Copilot Delegation (headless)
            await self.simulate_copilot_delegation(delegation_plan)
            
            # Phase 5: Generate Action Report
            action_report = await self.generate_action_report(delegation_plan)
            
            return {
                "session_id": session_id,
                "success": True,
                "analysis": self.analysis_results,
                "delegation_plan": delegation_plan,
                "copilot_procedures": copilot_procedures,
                "action_report": action_report,
                "mode": "headless_simulation"
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
                
                # Parse instructions with AI (if available)
                if self.client:
                    parsed_instructions = await self.parse_copilot_instructions_with_ai(instructions_content)
                else:
                    parsed_instructions = self.parse_copilot_instructions_simple(instructions_content)
                
                print("📚 Copilot instructions loaded and parsed")
                return parsed_instructions
                
            except Exception as e:
                print(f"⚠️ Could not read copilot instructions: {e}")
                return self.get_default_copilot_procedures()
        else:
            print("📝 No copilot-instructions.md found, creating template...")
            await self.create_copilot_instructions_template(copilot_instructions_path)
            return self.get_default_copilot_procedures()
    
    def parse_copilot_instructions_simple(self, instructions_content: str) -> Dict:
        """Simple parsing when AI is not available"""
        # Extract basic structure from markdown
        procedures = {
            "workflow": "standard",
            "steps": [],
            "preferences": {}
        }
        
        lines = instructions_content.split('\n')
        current_section = ""
        
        for line in lines:
            line = line.strip()
            if line.startswith('##'):
                current_section = line.replace('##', '').strip().lower()
            elif line.startswith('###'):
                current_section = line.replace('###', '').strip().lower()
            elif line.startswith('- ') and 'procedure' in current_section:
                action = line.replace('- ', '').strip()
                procedures['steps'].append({
                    "phase": current_section,
                    "action": action
                })
        
        return procedures
    
    async def research_project_documentation(self, project_path: str):
        """Phase 1: Research all project documentation"""
        print("📚 Phase 1: Researching Project Documentation")
        
        # Find and read documentation files
        doc_files = self.find_documentation_files(project_path)
        
        print(f"📄 Found {len(doc_files)} documentation files")
        
        documentation_content = ""
        for doc_file in doc_files:
            print(f"   Reading: {doc_file}")
            try:
                with open(doc_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    documentation_content += f"\\n\\n## {doc_file}\\n{content}"
            except Exception as e:
                print(f"   ⚠️ Could not read {doc_file}: {e}")
        
        # Analyze documentation with AI (if available)
        if documentation_content and self.client:
            analysis = await self.analyze_documentation_with_ai(documentation_content)
            self.analysis_results["documentation_summary"] = analysis
        elif documentation_content:
            # Simple analysis without AI
            word_count = len(documentation_content.split())
            self.analysis_results["documentation_summary"] = f"Documentation found with {word_count} words. Manual review recommended."
        
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
        
        # Generate delegation strategy with AI (if available)
        if self.client:
            delegation_plan = await self.generate_delegation_strategy_ai(context)
        else:
            delegation_plan = self.generate_delegation_strategy_simple(context)
        
        print("📋 Delegation plan created:")
        for i, step in enumerate(delegation_plan.get("steps", []), 1):
            print(f"   {i}. {step['action']} - {step['description']}")
        
        print("✅ Delegation planning completed")
        return delegation_plan
    
    def generate_delegation_strategy_simple(self, context: Dict) -> Dict:
        """Generate delegation strategy without AI"""
        procedures = context.get('copilot_procedures', {})
        
        # Create basic plan based on task and procedures
        steps = []
        
        # Preparation phase
        steps.append({
            "action": "analyze_task",
            "description": f"Analyze the task: {context['task'][:50]}...",
            "phase": "preparation"
        })
        
        # Find relevant files
        for key_file in context['key_files'][:3]:
            steps.append({
                "action": "open_file",
                "description": f"Open key file for editing",
                "file_path": key_file,
                "phase": "delegation"
            })
        
        # Add task-specific steps
        task_lower = context['task'].lower()
        if 'error' in task_lower or 'handling' in task_lower:
            steps.append({
                "action": "add_error_handling",
                "description": "Add comprehensive error handling",
                "prompt": "Add try-catch blocks and proper error handling",
                "phase": "execution"
            })
        
        if 'test' in task_lower:
            steps.append({
                "action": "create_tests",
                "description": "Create unit tests",
                "prompt": "Generate comprehensive unit tests",
                "phase": "validation"
            })
        
        # Final validation
        steps.append({
            "action": "run_tests",
            "description": "Run tests to verify functionality",
            "phase": "validation"
        })
        
        return {
            "workflow": procedures.get('workflow', 'standard'),
            "steps": steps,
            "total_steps": len(steps)
        }
    
    async def simulate_copilot_delegation(self, delegation_plan: Dict):
        """Phase 4: Simulate delegation execution (headless mode)"""
        print("🖥️ Phase 4: Simulating Copilot Delegation (Headless Mode)")
        
        for i, step in enumerate(delegation_plan.get("steps", []), 1):
            print(f"\\n🔄 Simulating Step {i}: {step['action']}")
            
            # Simulate different actions
            if step["action"] == "open_file":
                print(f"   📂 Would open file: {step.get('file_path', 'unknown')}")
            elif step["action"] == "trigger_copilot":
                print(f"   💭 Would trigger Copilot with: {step.get('prompt', 'no prompt')}")
            elif step["action"] == "add_error_handling":
                print(f"   🛡️ Would add error handling to code")
            elif step["action"] == "create_tests":
                print(f"   🧪 Would create unit tests")
            elif step["action"] == "run_tests":
                print(f"   ▶️ Would run test suite")
            else:
                print(f"   ⚙️ Would execute: {step.get('description', 'unknown action')}")
            
            # Brief pause to simulate work
            await asyncio.sleep(0.1)
        
        print("\\n✅ Delegation simulation completed")
    
    async def generate_action_report(self, delegation_plan: Dict) -> Dict:
        """Generate a comprehensive action report"""
        print("📊 Phase 5: Generating Action Report")
        
        total_steps = len(delegation_plan.get("steps", []))
        phases = {}
        
        # Count steps by phase
        for step in delegation_plan.get("steps", []):
            phase = step.get("phase", "unknown")
            phases[phase] = phases.get(phase, 0) + 1
        
        report = {
            "summary": {
                "total_steps": total_steps,
                "phases_breakdown": phases,
                "simulation_completed": True,
                "ready_for_execution": True
            },
            "next_actions": [
                "Open VS Code in the project directory",
                "Ensure GitHub Copilot extension is active",
                "Follow the generated delegation plan step by step",
                "Review and accept appropriate Copilot suggestions",
                "Test implementations thoroughly"
            ],
            "recommendations": [
                "Review the copilot-instructions.md file and customize as needed",
                "Consider breaking complex tasks into smaller sub-tasks",
                "Always test changes in a separate branch first",
                "Document any significant changes or decisions"
            ]
        }
        
        print(f"📈 Action report generated with {total_steps} steps across {len(phases)} phases")
        return report
    
    # Helper methods (reused from original implementation)
    
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
    
    # AI-powered methods (only used if OpenAI API key is available)
    
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
    
    async def analyze_documentation_with_ai(self, documentation_content: str) -> str:
        """Analyze documentation using OpenAI"""
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert code analyst. Summarize project documentation concisely."},
                    {"role": "user", "content": f"Analyze this project documentation and provide a concise summary:\\n\\n{documentation_content[:8000]}"}
                ],
                max_tokens=500
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"⚠️ AI analysis failed: {e}")
            return "Documentation analysis unavailable"
    
    async def generate_delegation_strategy_ai(self, context: Dict) -> Dict:
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
                    copilot_procedures_text += f"\\n- {step.get('phase', 'unknown')}: {', '.join(step.get('actions', []))}"
            
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
            return self.generate_delegation_strategy_simple(context)