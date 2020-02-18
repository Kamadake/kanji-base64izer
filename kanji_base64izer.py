from kanjibase64izer.base64izer import KanjiBase64izer

if __name__ == "__main__":
    kb = KanjiBase64izer()
    kb.read_cl_args()
    svgText = kb.get_base64_svg()
    print("-------------------------- RESULT --------------------------")
    print(svgText)
    print("------------------------------------------------------------")
    # do other stuff