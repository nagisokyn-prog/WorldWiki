#include "splash_screen.h"
#include <iostream>
#include <fstream>
#include <string>
#include <thread>
#include <chrono>
#include <filesystem>
#include <windows.h>

namespace fs = std::filesystem;

SplashScreen::SplashScreen() : max_lines(0), animation_complete(false), screen_width(1024), screen_height(768) {
    std::cout << "[PAINT] SplashScreen constructor called" << std::endl;
    std::cout << "[SCREEN] Screen size: " << screen_width << "x" << screen_height << std::endl;
    
    // Load ASCII arts
    loadAsciiArts();
}

SplashScreen::~SplashScreen() {
    std::cout << "[CLEAN] SplashScreen destructor called" << std::endl;
}

void SplashScreen::loadAsciiArts() {
    std::cout << "📂 Loading ASCII arts..." << std::endl;
    
    try {
        // Get the directory where the executable is located
        wchar_t exe_path[MAX_PATH];
        GetModuleFileNameW(nullptr, exe_path, MAX_PATH);
        fs::path exe_dir = fs::path(exe_path).parent_path();
        
        // Navigate to core/words directory
        fs::path words_dir = exe_dir.parent_path() / "core" / "words";
        
        std::cout << "🔍 Looking for words in: " << words_dir << std::endl;
        
        // Load WORLD
        fs::path world_file = words_dir / "world_ascii.txt";
        if (fs::exists(world_file)) {
            std::ifstream file(world_file);
            std::string line;
            while (std::getline(file, line)) {
                world_ascii.push_back(line);
            }
            file.close();
            std::cout << "[OK] Loaded WORLD ASCII (" << world_ascii.size() << " lines)" << std::endl;
        } else {
            std::cout << "[WARN] world_ascii.txt not found at: " << world_file << std::endl;
        }
        
        // Load WIKI
        fs::path wiki_file = words_dir / "wiki_ascii.txt";
        if (fs::exists(wiki_file)) {
            std::ifstream file(wiki_file);
            std::string line;
            while (std::getline(file, line)) {
                wiki_ascii.push_back(line);
            }
            file.close();
            std::cout << "[OK] Loaded WIKI ASCII (" << wiki_ascii.size() << " lines)" << std::endl;
        } else {
            std::cout << "[WARN] wiki_ascii.txt not found at: " << wiki_file << std::endl;
        }
        
        // Load WOWILON
        fs::path wowilon_file = words_dir / "wowilon_ascii.txt";
        if (fs::exists(wowilon_file)) {
            std::ifstream file(wowilon_file);
            std::string line;
            while (std::getline(file, line)) {
                wowilon_ascii.push_back(line);
            }
            file.close();
            std::cout << "[OK] Loaded WOWILON ASCII (" << wowilon_ascii.size() << " lines)" << std::endl;
        } else {
            std::cout << "[WARN] wowilon_ascii.txt not found at: " << wowilon_file << std::endl;
        }
        
    } catch (const std::exception& e) {
        std::cerr << "[ERROR] Error loading ASCII arts: " << e.what() << std::endl;
    }
}

void SplashScreen::show() {
    std::cout << "[PLAY] Showing splash screen..." << std::endl;
    
    // Display ASCII arts to console
    std::cout << std::endl;
    std::cout << "╔════════════════════════════════════════════════════════════╗" << std::endl;
    std::cout << "║                     WORLD WIKI - ALPHA                     ║" << std::endl;
    std::cout << "║                  HTTP Server Edition v1.0.0                ║" << std::endl;
    std::cout << "╚════════════════════════════════════════════════════════════╝" << std::endl;
    std::cout << std::endl;
    
    // Display WORLD
    std::cout << "[WORLD]" << std::endl;
    for (const auto& line : world_ascii) {
        std::cout << line << std::endl;
    }
    std::cout << std::endl;
    
    // Display WIKI
    std::cout << "[WIKI]" << std::endl;
    for (const auto& line : wiki_ascii) {
        std::cout << line << std::endl;
    }
    std::cout << std::endl;
    
    // Display startup message
    std::cout << "[START] Starting World Wiki Server..." << std::endl;
    std::cout << "[TIME] This may take a moment..." << std::endl;
    std::cout << std::endl;
}

void SplashScreen::hide() {
    std::cout << "[PLAY] Hiding splash screen..." << std::endl;
}

void SplashScreen::setProgress(const char* text, double percent) {
    int bar_width = 50;
    int filled = (int)(percent * bar_width);
    
    std::cout << "\r[";
    for (int i = 0; i < bar_width; ++i) {
        if (i < filled) std::cout << "█";
        else std::cout << "░";
    }
    std::cout << "] " << (int)(percent * 100) << "% - " << text;
    std::cout.flush();
}

void SplashScreen::runAnimation() {
    std::cout << "🎬 Starting ASCII animation..." << std::endl;
    
    int total_steps = world_ascii.size() + wiki_ascii.size() + wowilon_ascii.size();
    int current_step = 0;
    
    // Simulate animation with progress updates
    setProgress("Initializing...", 0.0);
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
    
    setProgress("Rendering WORLD...", 0.2);
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
    
    setProgress("Rendering WIKI...", 0.4);
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
    
    setProgress("Rendering WOWILON...", 0.6);
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
    
    setProgress("Loading resources...", 0.8);
    std::this_thread::sleep_for(std::chrono::milliseconds(500));
    
    setProgress("Ready!", 1.0);
    std::cout << std::endl;
    
    animation_complete = true;
    std::cout << "[OK] Animation complete!" << std::endl;
}

bool SplashScreen::isAnimationComplete() {
    return animation_complete;
}

void SplashScreen::processEvents() {
    // No-op for Windows console version
}

// Placeholder for GTK/Cairo functions - not used in console version
int SplashScreen::on_draw(GtkWidget* widget, cairo_t* cr, void* data) {  // gboolean -> int
    return 0;
}

void SplashScreen::drawAsciiArt(cairo_t* cr) {
    // No-op for Windows console version - ASCII art is printed to console in show()
}
