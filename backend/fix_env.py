import os

def fix_env_format(env_path='.env'):
    if not os.path.exists(env_path):
        print(f"❌ 错误: 找不到文件 {env_path}")
        return

    # 1. 读取原始文件（处理 UTF-8 BOM）
    with open(env_path, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()

    fixed_lines = []
    for line in lines:
        line = line.strip()
        
        # 保留空行和注释
        if not line or line.startswith('#'):
            fixed_lines.append(line)
            continue
            
        # 2. 处理 KEY=VALUE
        if '=' in line:
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip()
            
            # 3. 检查是否需要加双引号
            # 如果值已经有引号则跳过，否则检查特殊字符
            special_chars = ['#', '$', ' ', '&', '(', ')', '@']
            has_special = any(char in value for char in special_chars)
            is_quoted = (value.startswith('"') and value.endswith('"')) or \
                        (value.startswith("'") and value.endswith("'"))
            
            if has_special and not is_quoted:
                value = f'"{value}"'
            
            fixed_lines.append(f"{key}={value}")
        else:
            # 对于不规范的行，原样保留或忽略
            fixed_lines.append(line)

    # 4. 写回文件
    with open(env_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(fixed_lines) + '\n')
    
    print(f"✅ 成功修复: {env_path}")
    print("--- 修复后的预览 ---")
    for l in fixed_lines:
        if 'PASSWORD' in l or 'KEY' in l: # 遮蔽敏感信息预览
            print(f"{l.split('=')[0]}=******")
        else:
            print(l)

if __name__ == "__main__":
    fix_env_format()