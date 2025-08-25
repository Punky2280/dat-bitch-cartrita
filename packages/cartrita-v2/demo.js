/**
 * Cartrita V2 - Computer Agent Demo
 * Demonstrates the multi-agent system and computer use capabilities
 */

const axios = require('axios');

class CartritaV2Demo {
    constructor() {
        this.baseUrl = 'http://localhost:8002';
        this.demoTasks = [
            {
                name: "Screenshot Task",
                request: {
                    message: "Take a screenshot of the current desktop",
                    user_id: "demo_user"
                }
            },
            {
                name: "Web Search Task", 
                request: {
                    message: "Perform a web search for the latest OpenAI developments",
                    user_id: "demo_user"
                }
            },
            {
                name: "Computer Control Task",
                endpoint: '/api/computer',
                request: {
                    task_description: "Take control of the PC, open a web browser, navigate to Google, and search for 'OpenAI latest news 2025'",
                    user_id: "demo_user",
                    max_iterations: 5
                }
            },
            {
                name: "Complex Automation Task",
                endpoint: '/api/computer',
                request: {
                    task_description: "Automate the following sequence: 1) Take a screenshot, 2) Open Firefox or Chrome, 3) Navigate to news.ycombinator.com, 4) Search for AI-related posts, 5) Take another screenshot",
                    user_id: "demo_user",
                    max_iterations: 10
                }
            }
        ];
    }
    
    async runDemo() {
        console.log('🎭 Starting Cartrita V2 Computer Agent Demo');
        console.log('=' .repeat(60));
        console.log('');
        
        // Test server health first
        await this.testServerHealth();
        
        // Run demo tasks
        for (const task of this.demoTasks) {
            await this.runTask(task);
            console.log(''); // Space between tasks
        }
        
        console.log('✅ Demo completed successfully!');
        console.log('');
        console.log('🚀 Key Features Demonstrated:');
        console.log('   • Multi-agent task routing');
        console.log('   • Computer use agent simulation');
        console.log('   • Desktop automation capabilities');
        console.log('   • Web browser control');
        console.log('   • Screenshot functionality');
        console.log('   • Complex task orchestration');
        console.log('');
        console.log('📋 Next Steps:');
        console.log('   • Configure OpenAI API key for full AI capabilities');
        console.log('   • Setup X11 display for actual GUI automation');
        console.log('   • Deploy to production environment');
        console.log('   • Integrate with frontend interface');
    }
    
    async testServerHealth() {
        console.log('🏥 Testing Server Health...');
        
        try {
            const response = await axios.get(`${this.baseUrl}/health`);
            console.log('✅ Server Status:', response.data.status);
            console.log('   Version:', response.data.version);
            console.log('   Uptime:', Math.round(response.data.uptime), 'seconds');
        } catch (error) {
            console.error('❌ Server health check failed:', error.message);
            throw error;
        }
        
        console.log('');
    }
    
    async runTask(task) {
        console.log(`🧪 Running: ${task.name}`);
        console.log('-'.repeat(40));
        
        try {
            const endpoint = task.endpoint || '/api/chat';
            const url = `${this.baseUrl}${endpoint}`;
            
            console.log('📤 Request:', JSON.stringify(task.request, null, 2));
            
            const startTime = Date.now();
            const response = await axios.post(url, task.request);
            const duration = Date.now() - startTime;
            
            console.log('📥 Response:');
            console.log('   Success:', response.data.success);
            console.log('   Agent:', response.data.agent_id);
            console.log('   Content:', response.data.content);
            
            if (response.data.computer_actions) {
                console.log('   Computer Actions:');
                response.data.computer_actions.forEach((action, index) => {
                    console.log(`     ${index + 1}. ${action.action} - ${action.success ? 'Success' : 'Failed'}`);
                });
            }
            
            if (response.data.tools_used) {
                console.log('   Tools Used:', response.data.tools_used.join(', '));
            }
            
            if (response.data.session_id) {
                console.log('   Session ID:', response.data.session_id);
            }
            
            console.log('   Duration:', duration + 'ms');
            console.log('✅ Task completed successfully');
            
        } catch (error) {
            console.error('❌ Task failed:', error.message);
            if (error.response?.data) {
                console.error('   Error details:', error.response.data);
            }
        }
    }
}

// Advanced demo scenarios
class AdvancedCartritaDemo extends CartritaV2Demo {
    constructor() {
        super();
        this.advancedTasks = [
            {
                name: "Multi-Step Web Research",
                endpoint: '/api/computer',
                request: {
                    task_description: `
                    Perform comprehensive web research on AI developments:
                    1. Open web browser
                    2. Search for "OpenAI GPT-5 2025 release date"
                    3. Visit top 3 results
                    4. Take screenshots of each page
                    5. Compile findings summary
                    `,
                    user_id: "research_demo",
                    max_iterations: 15
                }
            },
            {
                name: "Desktop Application Automation",
                endpoint: '/api/computer',
                request: {
                    task_description: `
                    Automate desktop productivity workflow:
                    1. Take initial screenshot
                    2. Open file manager
                    3. Navigate to Downloads folder
                    4. Create new folder "AI_Research_$(date)"
                    5. Open text editor
                    6. Create research notes document
                    7. Save document to new folder
                    `,
                    user_id: "productivity_demo",
                    max_iterations: 20
                }
            },
            {
                name: "Web Application Testing",
                endpoint: '/api/computer',
                request: {
                    task_description: `
                    Perform web application testing:
                    1. Open browser
                    2. Navigate to a demo web app
                    3. Fill out forms with test data
                    4. Click buttons and test navigation
                    5. Verify page elements load correctly
                    6. Take screenshots for test documentation
                    `,
                    user_id: "testing_demo",
                    max_iterations: 12
                }
            }
        ];
    }
    
    async runAdvancedDemo() {
        console.log('🚀 Starting Advanced Cartrita V2 Demo');
        console.log('=' .repeat(60));
        console.log('');
        
        console.log('⚡ Advanced Features:');
        console.log('   • Complex multi-step automation');
        console.log('   • Desktop application control');
        console.log('   • Web application testing');
        console.log('   • File system operations');
        console.log('   • Screenshot documentation');
        console.log('');
        
        for (const task of this.advancedTasks) {
            await this.runTask(task);
            console.log('');
        }
        
        console.log('🎯 Advanced Demo Complete!');
    }
}

// Run demo if called directly
if (require.main === module) {
    const demo = new CartritaV2Demo();
    
    // Check for advanced demo flag
    const isAdvanced = process.argv.includes('--advanced');
    
    if (isAdvanced) {
        const advancedDemo = new AdvancedCartritaDemo();
        advancedDemo.runAdvancedDemo().catch(error => {
            console.error('💥 Advanced demo failed:', error.message);
            process.exit(1);
        });
    } else {
        demo.runDemo().catch(error => {
            console.error('💥 Demo failed:', error.message);
            process.exit(1);
        });
    }
}

module.exports = { CartritaV2Demo, AdvancedCartritaDemo };