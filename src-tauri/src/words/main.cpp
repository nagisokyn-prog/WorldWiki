#include "application.h"
#include <iostream>
#include <windows.h>

#pragma comment(lib, "user32.lib")
#pragma comment(lib, "kernel32.lib")
#pragma comment(lib, "shell32.lib")

int main(int argc, char* argv[]) {
    try {
        std::cout << "===== WORLD WIKI - ALPHA VERSION 1.0.0 =====" << std::endl;
        std::cout << "HTTP Server Edition" << std::endl;
        std::cout << "===========================================\n" << std::endl;
        
        std::cout << "Starting World Wiki..." << std::endl;
        std::cout << "Version: 1.0.0 (Alpha)" << std::endl;
        std::cout << "Platform: Windows 10/11 (HTTP Server Mode)\n" << std::endl;
        
        // Create and initialize application
        Application app;
        std::cout << "Application object created" << std::endl;
        
        // Initialize application
        if (!app.initialize(argc, argv)) {
            std::cerr << "Application initialization failed!" << std::endl;
            return 1;
        }
        
        std::cout << "Application initialized successfully\n" << std::endl;
        
        // Display info
        std::cout << "========================================" << std::endl;
        std::cout << "Server is running at: http://localhost:3000/" << std::endl;
        std::cout << "WebUI Root: " << app.getWebUIRoot() << std::endl;
        std::cout << "Saves Root: " << app.getSavesPath() << std::endl;
        std::cout << "========================================\n" << std::endl;
        std::cout << "Press Ctrl+C to stop the server...\n" << std::endl;
        
        // Run main loop
        app.run();
        
        std::cout << "\nApplication finished" << std::endl;
        
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "Exception: " << e.what() << std::endl;
        return 1;
    }
}
