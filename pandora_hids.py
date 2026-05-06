import time
import threading
import os
import sys
import re
import subprocess

LOG_FILES = [
    "/var/log/auth.log",
    "./logs/access.log",
    "./logs/error.log"
]

BANNED_IPS = set()


WHITELIST_IPS = ["127.0.0.1", "172.21.0.1", "-"]

# --- MOTORE DI DETECTION (FIRME DEGLI ATTACCHI) ---
SIGNATURES = {
    "SQL_INJECTION": re.compile(r"(%27|')(%20|\s|\+)*(OR|UNION|SELECT|INSERT|DROP|AND)", re.IGNORECASE),
    # "XSS_ATTACK": re.compile(r"(%3C|<)(script|img)|onerror\s*=|document\.cookie|btoa\(|atob\(|eval\(", re.IGNORECASE),
    # "SSH_BRUTE_FORCE": re.compile(r"Failed password.*from\s+([0-9.]+)|Invalid user.*from\s+([0-9.]+)")
}

def ban_ip(ip):
    """
    Funzione di mitigazione attiva (Risoluzione Docker Bypass).
    """
    if ip in BANNED_IPS or ip in WHITELIST_IPS:
        return

    print(f"\n[⚡ ACTION] Esecuzione mitigazione attiva contro l'IP: {ip}")
    try:
        subprocess.run(["iptables", "-I", "DOCKER-USER", "-s", ip, "-j", "DROP"], check=True)
        
        subprocess.run(["iptables", "-I", "INPUT", "-s", ip, "-j", "DROP"], check=True)
        
        BANNED_IPS.add(ip)
        print(f"✅ [MITIGATO] IP {ip} bloccato a livello Host e Container!")
    
    except subprocess.CalledProcessError as e:
        print(f"❌ [ERRORE] Fallimento inserimento regola iptables: {e}")

def extract_web_ip(line):
    """
    Estrae l'IP sorgente dalla prima colonna del log Nginx.
    """
    match = re.search(r"^([0-9\.]+)", line)
    return match.group(1) if match else "-"

def analyze_log(line, filename):
    if filename == "access.log":
        if SIGNATURES["SQL_INJECTION"].search(line):
            attacker_ip = extract_web_ip(line)
            print(f"\n🚨 [ALLARME ROSSO] SQL Injection Rilevata da IP: {attacker_ip}!")
            ban_ip(attacker_ip)
            
        elif SIGNATURES["XSS_ATTACK"].search(line):
            attacker_ip = extract_web_ip(line)
            print(f"\n🚨 [ALLARME ROSSO] XSS Rilevato da IP: {attacker_ip}!")
            ban_ip(attacker_ip)

    elif filename == "auth.log":
        match = SIGNATURES["SSH_BRUTE_FORCE"].search(line)
        if match:
            attacker_ip = match.group(1) or match.group(2)
            print(f"\n⚠️ [ALLARME GIALLO] Brute Force SSH Rilevato da IP: {attacker_ip}")
            ban_ip(attacker_ip)

def tail_file(filepath):
    try:
        while not os.path.exists(filepath):
            time.sleep(2)

        with open(filepath, 'r') as f:
            f.seek(0, os.SEEK_END)
            
            while True:
                line = f.readline()
                if not line:
                    time.sleep(0.1)
                    continue
                
                analyze_log(line, os.path.basename(filepath))

    except PermissionError:
        print(f"[ERRORE FATALE] Permessi negati per {filepath}.")
        sys.exit(1)

def main():
    print("="*65)
    print("PANDORA SHIELD - IPS Engine (Fase 12: Active Mitigation)")
    print("="*65)
    print(f"[*] Whitelist attiva: {WHITELIST_IPS}")
    print("[*] Motore connesso a iptables. Pronto all'ingaggio...\n")

    threads = []
    for log_file in LOG_FILES:
        t = threading.Thread(target=tail_file, args=(log_file,), daemon=True)
        t.start()
        threads.append(t)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[!] Spegnimento IPS in corso...")
        sys.exit(0)

if __name__ == "__main__":
    main()