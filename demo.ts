interface SelectorAttribute {
    name: string;
    value: string;
    operator: string;
    required: boolean;
}

interface Window {
    uiaMetadata: {
        uidKey: string;
        latestUid: number;
    };
    uiaI18n: {
        data: { [key: string]: string };
        init: () => void;
        get: (key: string) => string;
    };
}

if (!window.uiaMetadata) {
    window.uiaMetadata = {
        uidKey: 'uia-uid',
        latestUid: 0
    }
}

class Rect {
    x: number
    y: number
    width: number
    height: number
    constructor(x: number, y: number, width: number, height: number) {
        this.x = x
        this.y = y
        this.width = width
        this.height = height
    }


    contains(point: Point) {
        return point.x >= this.x && point.x <= (this.width + this.x) && point.y >= this.y && point.y <= (this.height + this.y)
    }

    center() {
        return {
            x: Math.round(this.x + this.width / 2),
            y: Math.round(this.y + this.height / 2)
        }
    }

    offset(x: number, y: number) {
        this.x += x
        this.y += y
    }

    scale(ratio: number) {
        return new Rect(Math.round(this.x * ratio), Math.round(this.y * ratio),
            Math.round(this.width * ratio), Math.round(this.height * ratio))
    }

    ScaleInv(ratio: number) {
        return new Rect(Math.round(this.x / ratio), Math.round(this.y / ratio),
            Math.round(this.width / ratio), Math.round(this.height / ratio))
    }

    intersect(rect: Rect) {
        const x1 = Math.max(this.x, rect.x)
        const x2 = Math.min(this.x + this.width, rect.x + rect.width)
        const y1 = Math.max(this.y, rect.y)
        const y2 = Math.min(this.y + this.height, rect.y + rect.height)
        if (x2 >= x1 && y2 >= y1) {
            return new Rect(x1, y1, x2 - x1, y2 - y1)
        } else {
            return null
        }
    }

    static fromRect(rect: Rect) {
        return new Rect(rect.x, rect.y, rect.width, rect.height)
    }

    static fromDOMRect(domRect: DOMRect) {
        return new Rect(Math.round(domRect.x), Math.round(domRect.y),
            Math.round(domRect.width), Math.round(domRect.height))
    }

    static toDOMRect(rect: Rect) {
        return new DOMRect(rect.x, rect.y, rect.width, rect.height)
    }
}

interface FeatureSelectorNode {
    name: string;
    type: FeatureSelectorNodeType;
    bounding: Rect;
    isAnchor: boolean;
    allowNull: boolean;
    visualAttributes: string[];
    attributes: SelectorAttribute[];
    similarAlignment: string[] | null;
    fuzzy: number;
}


interface SelectorNode {
    name: string;
    type: string;
    attributes: SelectorAttribute[];
}

interface FeatureSelectorTargetNode extends FeatureSelectorNode {
    parent: HTMLElement
}

interface DatePickerElements {
    preMonth: HTMLElement | null;
    yearMonth: HTMLElement;
    nextMonth: HTMLElement | null;
    dateCells: HTMLElement[];
}
enum FeatureSelectorNodeType {
    Single = "single",
    Similar = "similar",
}

class TreeNode {
    node: HTMLElement;
    parent: TreeNode | null;
    children: TreeNode[];
    constructor(node: HTMLElement, parent: TreeNode | null = null) {
        this.node = node;
        this.parent = parent;
        this.children = [];
    }

    addChild(childNode: TreeNode) {
        this.children.push(childNode);
        childNode.parent = this;
    }

    contains(element: TreeNode) {
        for (let child of this.children) {
            if (child.node === element.node || child.contains(element)) {
                return true;
            }
        }
        return false;
    }
}


const TAGS = {
    HTML: 'HTML',
    BODY: 'BODY',
    TABLE: 'TABLE',
    INPUT: 'INPUT',
    BUTTON: 'BUTTON',
    SELECT: 'SELECT',
    LABEL: 'LABEL',
    TEXTAREA: 'TEXTAREA',
    IFRAME: 'IFRAME',
    FRAME: 'FRAME',
    A: 'A',
    IMG: 'IMG',
    SCRIPT: 'SCRIPT'
}

const STRINGS = {
    XBOT_SHADOWROOT: 'xbotShadowRoot'
}

class domUtils {
    static checkIfNodeIsShadowRoot(element: Node): boolean {
        throw new Error('Not implemented yet');
    }

    static extractAttributes(element: Element) {
        const attributeNameCheck = new RegExp("^[A-Za-z_][A-Za-z0-9_.-]*$");
        const attrDict: { [key: string]: string } = {}
        const names = element.getAttributeNames()
        for (const name of names) {
            if (!attributeNameCheck.test(name))
                continue;
            let value = element.getAttribute(name) || ''
            switch (name) {
                case 'id':
                    attrDict['id'] = value
                    break
                case 'title':
                    if (value.length < 50) {
                        attrDict['title'] = value
                    }
                    break
                case 'class':
                case window.uiaMetadata.uidKey:
                    break
                default:
                    attrDict[name] = value
                    break
            }
        }
        if (element.classList.length > 0) {
            attrDict['class'] = [...element.classList].map(item => item.toLowerCase()).sort().join(' ')
        }

        if (element.childElementCount === 0 && //只有当DOM元素中没有子元素时才会取它的innerText
            !domUtils.matchElementType(element, TAGS.INPUT, TAGS.SELECT, TAGS.TEXTAREA)) {
            let text = element.innerText
            if (text && text.length > 0 && text.length < 50) {
                attrDict['innerText'] = text
            }
        }

        attrDict['tagName'] = element.tagName

        if (element.parentElement) {
            attrDict['index'] = this.getIndex(element).toString();
            attrDict['index-of-type'] = this.getRoleIndex(element).toString();
        }
        return attrDict
    }

    static matchElementType(ele: Element, ...tags: string[]): boolean {
        if (!!ele && ele.nodeType === Node.ELEMENT_NODE) {
            const curTag = domUtils.getTagName(ele).toUpperCase()
            for (const tag of tags) {
                if (tag === curTag) {
                    return true
                }
            }
        }
        return false
    }

    static getTagName(element: Element): string {
        // 某些情况下Form标签的tagName是input元素
        if (typeof (element.tagName) === 'string') {
            return element.tagName.toLowerCase()
        } else {
            return element.nodeName.toLowerCase()
        }
    }

    static getIndex(element: Element) {
        let tagName = this.getTagName(element);
        let elements = Array.prototype.filter.call(element.parentElement!.children, ele => this.getTagName(ele) == tagName);
        return Array.prototype.indexOf.call(elements, element)
    }

    static isDisplayed(ele: Element): boolean {
        //元素隐藏暂时不考虑opacity的情况
        let visibility = getComputedStyle(ele).visibility; //计算样式visibility只有visible和hidden两种情况
        if (visibility == 'visible') //需要进一步观察，看它是不是在一个不可见的容器中
        {
            while (ele && ele.nodeType == 1) {
                let display = getComputedStyle(ele).display;
                let opacity = getComputedStyle(ele).opacity;
                if (display == '' || display == 'none' || opacity == '0')
                    return false;
                ele = ele.parentNode as Element;
            }
            return true
        } else {
            return false; //不管容器可不可见，如果自身是不可见的就不可见
        }
    }

    static getRoleIndex(element: Element): number {
        let tagName = this.getTagName(element);
        let elements = Array.prototype.filter.call(element.parentElement!.children, ele => this.getTagName(ele) == tagName);
        return Array.prototype.indexOf.call(elements, element)
    }

    static elementFromPoint(x: number, y: number): HTMLElement {
        throw new Error('Not implemented yet');
    }

    static buildSelector(element: HTMLElement): SelectorNode[] {
        throw new Error('Not implemented yet');
    }

    static getFrameOffset(element: HTMLElement): { x: number, y: number } {
        throw new Error('Not implemented yet');
    }

    static uidFromElement(element: HTMLElement): string {
        throw new Error('Not implemented yet');
    }

    static getFrameIndex(element: HTMLElement): number {
        throw new Error('Not implemented yet');
    }

    static elementFromUid(uid: string): HTMLElement {
        throw new Error('Not implemented yet');
    }

    static querySPath(spath: SelectorNode[], parent: HTMLElement | null): HTMLElement[] {
        throw new Error('Not implemented yet');
    }

    static isElementMatchSelectorNodeAttribute = (element: HTMLElement, selectorNodeAttributes: SelectorAttribute[] | undefined, isLastSelectorNode: boolean) => {
        //判断两个属性值是否等价
        function isAttributeMatch(value: string, sAttr: SelectorAttribute) {
            switch (sAttr.operator) {
                case 'equal':
                    if (sAttr.name === 'class') {
                        if (value === sAttr.value) {
                            return true
                        } else {
                            if (!value) {
                                return false
                            }
                            //"red h1" 等价于 "h1 red"，忽略顺序
                            let sValue = sAttr.value.match(/[^ ]+/g)!.map(item => item.toLowerCase()).sort().join(' ')
                            return value === sValue
                        }
                    } else {
                        return value === sAttr.value
                    };
                case 'Include':
                    if (sAttr.name === 'class') {
                        if (value === sAttr.value) {
                            return true
                        } else {
                            if (!value) {
                                return false
                            }
                            //"red h1" 等价于 "h1 red"，忽略顺序
                            let classes = value.split(' ');
                            for (const sClassName of sAttr.value.split(' ')) {
                                if (!classes.some((className) => className === sClassName))
                                    return false;
                            }
                            return true
                        }
                    } else {
                        return value === sAttr.value
                    };
                case 'regex': // 正则和通配符直接使用用户提供的表达式匹配
                    if (value && value.length > 5 * 1024) return false //存在正则表达式匹配过长value导致浏览器卡死，限制value最大长度
                    try {
                        return (new RegExp(sAttr.value)).test(value);
                    } catch (e) {
                        throw new ActionError(window.uiaI18n.get('InvalidRegexWithError').format(sAttr.value))
                    }
                case 'wildcard':
                    if (value && value.length > 5 * 1024) return false //存在正则表达式匹配过长value导致浏览器卡死，限制value最大长度
                    return wildcardsMatchText(sAttr.value, value);
                default:
                    return false
            }
        }
        // index typeIndex不支持正则和通配符
        function isIndexAttributeMatch(total: number, eleIndex: number, nodeIndex: number) {
            if (nodeIndex < 0) {
                var a = total == Math.abs(nodeIndex) + Math.abs(eleIndex)
                return a
            } else {
                return nodeIndex == eleIndex
            }
        }

        function wildcardsMatchText(wcValue: string, text: string) {
            function wildcardToRegex(pattern: string) {
                return '^' + pattern.replaceAll('*', '.*').replaceAll('?', '.') + '$'
            }

            const wcRegex = wildcardToRegex(wcValue)
            return (new RegExp(wcRegex, 'im')).test(text);
        }
        if (!selectorNodeAttributes || selectorNodeAttributes.length === 0)
            return true;

        var attrs = domUtils.extractAttributes(element);
        for (const sAttr of selectorNodeAttributes) { //选择器一个节点中的所有属性selectorNode.attributes，sAttr
            if (sAttr.required) {
                if (sAttr.name === "index") {
                    // TODO: shadow模式下parentElement可能为null
                    if (!isIndexAttributeMatch(element.parentElement!.children.length, attrs[sAttr.name], parseInt(sAttr.value))) {
                        return false;
                    }
                } else if (sAttr.name === "index-of-type") {
                    const tagName = domUtils.getTagName(element)
                    const elements = Array.prototype.filter.call(element.parentElement!.children, e => domUtils.getTagName(e) === tagName);
                    const eleIndex = domUtils.getRoleIndex(element);
                    if (!isIndexAttributeMatch(elements.length, eleIndex, parseInt(sAttr.value))) {
                        return false;
                    }
                } else if (sAttr.name === "xbox-display") {
                    if (domUtils.isDisplayed(element).toString() !== sAttr.value) {
                        return false;
                    }
                } else {
                    // <input> type属性默认为 "text", match时"text"等效于 undefined
                    if (domUtils.getTagName(element) === "input" && sAttr.name === "type" && sAttr.value === "text") {
                        if (attrs[sAttr.name] && attrs[sAttr.name] !== "text") {
                            return false;
                        }
                    }
                    // 兼容已存在非leaf节点但有 innerText属性的 selector /or/ 最后一个selector节点(非 leaf节点) 用户手动添加了 innerText的情况
                    if (isLastSelectorNode && sAttr.name === "innerText" && element.childElementCount) {
                        attrs["innerText"] = element.innerText
                    }
                    if (!isAttributeMatch(attrs[sAttr.name], sAttr)) {
                        return false;
                    }
                }
            }
        }
        return true;

    }


    static isElementMatchSelector = (element: HTMLElement, selector: any) => {
        const selectorLength = selector.length
        const result = { isMatch: true, selectorIndex: selectorLength }
        /**
         * 
         * 链式对应关系
         * selectorNode1 => loopNode => element
         * selectorNode2 => loopNode.parent => element.parent
         * selectorNode3(xbotShadowRoot) => loopNode.parent.parent(ShadowRoot) => null
         * selectorNode4 => loopNode重置为(loopNode.parent.parent.host) => element重置为(loopNode.parent.parent.host)
         * TODO: parentNode与parentElement应该是同一个引用, 可以看看是否可以去掉element
         */
        let loopNode: HTMLElement | Node = element
        for (let i = selectorLength - 1; i >= 0; i--) {
            const selectorNode = selector[i];
            const isLastSelectorNode = i === selectorLength - 1;
            if (selectorNode.name === STRINGS.XBOT_SHADOWROOT) {
                if (domUtils.checkIfNodeIsShadowRoot(loopNode)) {
                    loopNode = (loopNode as ShadowRoot).host
                    element = loopNode as HTMLElement
                    continue
                } else {
                    result.selectorIndex = i
                    result.isMatch = false
                    break
                }
            } else {
                if (!element || !domUtils.isElementMatchSelectorNodeAttribute(element, selectorNode.attributes, isLastSelectorNode)) {
                    result.selectorIndex = i;
                    result.isMatch = false;
                    break;
                }
                element = element.parentElement!
                loopNode = loopNode.parentNode!
            }
        }
        return result
    }
}

class WebNode {
    element: Element
    classList: string[]
    attributes: { [key: string]: string }
    required: Set<string>
    forbiddenAttributes: string[]
    constructor(element: Element, forbiddenAttributes: string[] = []) {
        this.element = element
        this.classList = [...element.classList]
        let attrDict = domUtils.extractAttributes(element)
        delete attrDict['style']           //由于style可能会随着主题发生更改，所以构建选择器时去除该属性
        this.attributes = attrDict
        this.required = new Set()
        this.forbiddenAttributes = forbiddenAttributes
        // 为了防止出现运行时经常匹配到多个的问题，这里多加入一些属性，尽量严格一点
        if (domUtils.matchElementType(element, TAGS.INPUT, TAGS.BUTTON, TAGS.SELECT)) {
            if (this.attributes['type']) {
                this.required.add('type')
            }
            if (this.attributes['name']) {
                this.required.add('name')
            }
        }
        // 在diff的时候再判断是否required
        // if (this.attributes['id'] && !(/\d+/.test(this.attributes['id']))) {
        //     this.required.add('id')
        // }
    }

    attr(name: string) {
        return this.attributes[name] || null
    }

    parent() {
        const parent = this.element.parentElement
        if (parent == null) { // 有可能录制的HTML节点
            return null
        }
        const tagName = domUtils.getTagName(parent)
        if (tagName === 'body' || tagName === 'html') {
            return null
        } else {
            return new WebNode(parent)
        }
    }


    diff(other: WebNode) {
        if (this.element === other.element) {
            return true
        }

        const names = ['type', 'id', 'name', 'title', 'innerText', 'class', 'xbox-display', 'index']
        for (const name of names) {
            if (name === 'id' && /\d+/.test(this.attr(name)!)) {
                continue
            }
            if (name === 'class') {
                if (this.classList.length > 0) {
                    let classes = this.classList.filter(m => other.classList.indexOf(m) == -1);
                    if (classes.length > 0 && this.classList.some(m => !other.classList.includes(m)) && !/hover|[^a-zA-Z](?:on|open|active)/.test(classes.join(' '))) {
                        this.required.add(name)
                        return true
                    }
                }
            } else if (name === 'xbox-display') {
                if (!domUtils.isDisplayed(other.element) && domUtils.isDisplayed(this.element)) {
                    this.attributes["xbox-display"] = "true";
                    this.required.add("xbox-display");
                    return true
                }
            } else {
                if (this.attr(name) !== null && this.attr(name) !== other.attr(name)) {
                    this.required.add(name)
                    return true
                }
            }
        }
        return false
    }

    diffFeature(other: WebNode) {
        if (this.element === other.element) {
            return true
        }
        let names = ['tagName', 'type', 'id', 'name', 'title', 'innerText', 'class', 'xbox-display', 'index']
        names = names.filter(name => !this.forbiddenAttributes.includes(name))
        for (const name of names) {
            if (name === 'id' && /\d+/.test(this.attr(name)!)) {
                continue
            }
            if (name === 'class') {
                if (this.classList.length > 0) {
                    let classes = this.classList.filter(m => other.classList.indexOf(m) == -1);
                    if (classes.length > 0 && this.classList.some(m => !other.classList.includes(m)) && !/hover|[^a-zA-Z](?:on|open|active)/.test(classes.join(' '))) {
                        this.required.add(name)
                        return true
                    }
                }
            } else if (name === 'xbox-display') {
                if (!domUtils.isDisplayed(other.element) && domUtils.isDisplayed(this.element)) {
                    this.attributes["xbox-display"] = "true";
                    this.required.add("xbox-display");
                    return true
                }
            } else {
                if (this.attr(name) !== null && this.attr(name) !== other.attr(name)) {
                    this.required.add(name)
                    return true
                }
            }
        }
        return false
    }

    toSelectorAttribute(withTagName: boolean): SelectorAttribute[] {
        const attributes: SelectorAttribute[] = [];
        for (const [name, value] of Object.entries(this.attributes)) {
            if (name === "srcdoc" || value.length > 1000)
                continue;
            if (!withTagName && name === "tagName")
                continue;
            attributes.push({
                'name': name,
                'value': value,
                'operator': 'equal',
                'required': this.required.has(name)
            })
        }
        return attributes
    }


    toSelectorNode() {
        const node = {
            'name': domUtils.getTagName(this.element),
            'type': 'Web',
            'attributes': this.toSelectorAttribute(false)
        }
        return node
    }

}

interface BuildFeatureSelectorNodeNormalArgs {
    name: string,
    type: FeatureSelectorNodeType.Single,
    element: HTMLElement,
    isAnchor: boolean,
    visualAttributes?: string[],
}

interface BuildFeatureSelectorNodeSimilarArgs {
    name: string,
    type: FeatureSelectorNodeType.Similar,
    elements: HTMLElement[],
    isAnchor: boolean,
    visualAttributes?: string[],
}

enum VisualAttribute {
    Left = "left",
    Center = "center",
    Right = "right",
    Top = "top",
    Middle = "middle",
    Bottom = "bottom",
}

interface DateUtils {
    queryFeatureDateSelectorAll: (root: HTMLElement, featureSelectors: FeatureSelectorNode[]) => DatePickerElements[][];
    datepickerElementsEqual: (a: DatePickerElements, b: DatePickerElements) => boolean;
    isDirectPath: (element1: Element, element2: Element) => boolean;
    queryFeatureSelectorAll: (elements2Boxs: Map<HTMLElement, Rect>, featureSelector: FeatureSelectorNode[], mergeTrunck: boolean) => (HTMLElement | null | HTMLElement[])[][];
    querySimilarElements: (element2Box: Map<HTMLElement, Rect>, originElement: HTMLElement, alignments: string[]) => HTMLElement[];
    elment2Map: (root: HTMLElement) => Map<HTMLElement, Rect>
    visualAttributesMatch: (rect: Rect, nodeRect: Rect, visualAttributes: string[], fuzzy: number) => boolean;
    buildFeatureDateSelector: (root: HTMLElement, panels: DatePickerElements[]) => FeatureSelectorNode[];
    AddFeatureDateSelectorAttributes: (infos: (BuildFeatureSelectorNodeNormalArgs | BuildFeatureSelectorNodeSimilarArgs)[], selectors: FeatureSelectorNode[], root: HTMLElement) => void
    buildFeatureSelectorAttributes: (targetNodes: WebNode[], matchedElementsAll: (Element | Element[] | null)[][], selectors: FeatureSelectorNode[]) => void
    toCamelCase: (str: string) => string;
    buildFeatureSelectorNode: (base: Point, info: BuildFeatureSelectorNodeNormalArgs | BuildFeatureSelectorNodeSimilarArgs) => FeatureSelectorNode;
    getAlignment: (similarElementRects: DOMRect[]) => string[];
    getAlignmentOrigin: (similarElements: HTMLElement[], alignment: string[]) => HTMLElement | null;
    buildHeaderMap: (panel: DatePickerElements, prefix: string) => Map<string, HTMLElement>;
    // findCommonNodeParent: (elements: TreeNode[]) => TreeNode;
    // mapElementToNode: (node: TreeNode, element: HTMLElement) => TreeNode | null;
    // mapDatePickerElementsToNodes: (elements: DatePickerElements, treeNodeRoot: TreeNode, prefix: string) => [Map<string, TreeNode>, TreeNode[]];
    // buildVisualTree: (element: HTMLElement) => TreeNode;

    findYearMonthBase: (yearMonth: HTMLElement) => HTMLElement | null;
    findCommonParent: (elements: HTMLElement[]) => HTMLElement;

    isDayElement: (element: HTMLElement) => boolean;
    findAllDateCells: (root: HTMLElement) => HTMLElement[];
}

// @ts-ignore: Suppress error TS2339.
const dateUtils: DateUtils = new function (this: DateUtils) {
    this.isDayElement = (element: HTMLElement): boolean => {
        if (!element?.innerText) {
            return false;
        }
        return parseInt(element.innerText) > 0 && parseInt(element.innerText) < 32;
    }

    this.queryFeatureDateSelectorAll = (root: HTMLElement, featureSelectors: FeatureSelectorNode[]) => {
        let result: DatePickerElements[][] = []
        let elements2Boxs = this.elment2Map(root);
        let isMutiPanel = true;

        featureSelectors.forEach((node, i) => {
            if (node.name === "yearMonth")
                isMutiPanel = false;
        });
        let targets = this.queryFeatureSelectorAll(elements2Boxs, featureSelectors, false);
        targets.forEach(target => {
            if (isMutiPanel) {
                let leftDatePickerElements: any = { preMonth: null, yearMonth: null, nextMonth: null, dateCells: [] }!;
                let rightDatePickerElements: any = { preMonth: null, yearMonth: null, nextMonth: null, dateCells: [] }!;
                target.forEach((t, i) => {
                    switch (featureSelectors[i].name) {
                        case "leftPreMonth":
                            leftDatePickerElements.preMonth = t as HTMLElement;
                            break;
                        case "leftYearMonth":
                            leftDatePickerElements.yearMonth = t as HTMLElement;
                            break;
                        case "leftNextMonth":
                            leftDatePickerElements.nextMonth = t as HTMLElement;
                            break;
                        case "leftDateTable":
                            leftDatePickerElements.dateCells = this.findAllDateCells(t as HTMLElement);
                            break;
                        case "rightPreMonth":
                            rightDatePickerElements.preMonth = t as HTMLElement;
                            break;
                        case "rightYearMonth":
                            rightDatePickerElements.yearMonth = t as HTMLElement;
                            break;
                        case "rightNextMonth":
                            rightDatePickerElements.nextMonth = t as HTMLElement;
                            break;
                        case "rightDateTable":
                            rightDatePickerElements.dateCells = this.findAllDateCells(t as HTMLElement);
                            break;
                        default:
                            break;
                    }
                });
                if (leftDatePickerElements.dateCells.length === 0 || rightDatePickerElements.dateCells.length === 0)
                    return;

                if (result.every(m => !this.datepickerElementsEqual(m[0], leftDatePickerElements) || !this.datepickerElementsEqual(m[1], rightDatePickerElements)))
                    result.push([leftDatePickerElements, rightDatePickerElements]);
            }
            else {
                let datePickerElements: any = { preMonth: null, yearMonth: null, nextMonth: null, dateCells: [] }!;
                target.forEach((t, i) => {
                    switch (featureSelectors[i].name) {
                        case "preMonth":
                            datePickerElements.preMonth = t as HTMLElement;
                            break;
                        case "yearMonth":
                            datePickerElements.yearMonth = t as HTMLElement;
                            break;
                        case "nextMonth":
                            datePickerElements.nextMonth = t as HTMLElement;
                            break;
                        case "dateTable":
                            datePickerElements.dateCells = this.findAllDateCells(t as HTMLElement);
                            break;
                        default:
                            break;
                    }
                });
                if (datePickerElements.dateCells.length === 0)
                    return;
                if (result.every(m => !this.datepickerElementsEqual(m[0], datePickerElements)))
                    result.push([datePickerElements as DatePickerElements]);
            }
        });
        return result;
    }


    this.findAllDateCells = (root: HTMLElement) => {
        let result: HTMLElement[] = [];
        let layer = [root];
        while (layer.length > 0) {
            let cells: HTMLElement[] = [];
            let nextLayer: HTMLElement[] = [];
            for (let element of layer) {
                if (this.isDayElement(element)) {
                    cells.push(element);
                }
                for (let child of element?.children ?? []) {
                    nextLayer.push(child as HTMLElement);
                }
            }
            if (cells.length > 15) {
                result.push(...cells);
                break;
            }
            layer = nextLayer;
        }
        if (result.length == 0) {
            console.error("can not find date cells ", root);
        }
        return result;
    }
    this.datepickerElementsEqual = (a: DatePickerElements, b: DatePickerElements): boolean => {
        return a.preMonth === b.preMonth && a.yearMonth === b.yearMonth && a.nextMonth === b.nextMonth && a.dateCells.every(cell => b.dateCells.some(c => c === cell));
    }

    this.elment2Map = (root: HTMLElement): Map<HTMLElement, Rect> => {

        const elements = [];
        const queue = [root];
        while (queue.length > 0) {
            const currentLevelSize = queue.length;
            for (let i = 0; i < currentLevelSize; i++) {
                const currentNode = queue.shift();
                elements.push(currentNode!)
                for (let child of currentNode!.children) {
                    queue.push(child as HTMLElement);
                }
            }
        }
        const rootRect = root.getBoundingClientRect();
        return elements.reduce((map, element) => {
            // 确保元素是一个 DOM 元素并且存在于 DOM 中
            if (element instanceof Element) {
                let rect = element.getBoundingClientRect();
                map.set(element, new Rect(Math.round(rect.left - rootRect.left), Math.round(rect.top - rootRect.top), Math.round(rect.width), Math.round(rect.height)));
            }
            return map;
        }, new Map());
    }

    this.visualAttributesMatch = (rect: Rect, nodeRect: Rect, visualAttributes: string[], fuzzy: number) => {
        for (let attribute of visualAttributes) {
            switch (attribute) {
                case VisualAttribute.Left: {
                    if (Math.abs(rect.x - nodeRect.x) > fuzzy)
                        return false;
                    break;
                }
                case VisualAttribute.Center: {
                    // 中心点误差1px
                    if (Math.abs(Math.floor(rect.x + rect.width / 2) - Math.floor(nodeRect.x + nodeRect.width / 2)) - 1 > fuzzy)
                        return false;
                    break;
                }
                case VisualAttribute.Right: {
                    if (Math.abs((rect.x + rect.width) - (nodeRect.x + nodeRect.width)) > fuzzy)
                        return false;
                    break;
                }
                case VisualAttribute.Top: {
                    if (Math.abs(rect.y - nodeRect.y) > fuzzy)
                        return false;
                    break;
                }
                case VisualAttribute.Middle: {
                    // 中心点误差1px
                    if (Math.abs(Math.floor(rect.y + rect.height / 2) - Math.floor(nodeRect.y + nodeRect.height / 2)) - 1 > fuzzy)
                        return false;
                    break;
                }
                case VisualAttribute.Bottom: {
                    if (Math.abs((rect.y + rect.height) - (nodeRect.y + nodeRect.height)) > fuzzy)
                        return false;
                    break;
                }
            }
        }
        return true;
    }

    // 判断两个元素是否存在直接父级关系，且该路径下没有其他元素。
    this.isDirectPath = (element1: Element, element2: Element) => {
        function isDirectDescendant(parent: Element, child: Element) {
            let current: Element | null = child;
            while (current && current !== parent) {
                if (current.previousElementSibling || current.nextElementSibling) {
                    return false;
                }
                current = current.parentElement;
            }
            return current === parent;
        }

        return element1 !== element2 && element1.contains(element2) && isDirectDescendant(element1, element2)
    }

    this.queryFeatureSelectorAll = (elements2Boxs: Map<HTMLElement, Rect>, featureSelector: FeatureSelectorNode[], mergeTrunck: boolean = true) => {

        let calculateOffset = (preRect: Rect, nodeRect: Rect) => {
            let alignment = this.getAlignment([Rect.toDOMRect(preRect), Rect.toDOMRect(nodeRect)]);
            let x = 0;
            let y = 0;
            alignment.forEach((m) => {
                switch (m) {
                    case VisualAttribute.Left: x = 0; break;
                    case VisualAttribute.Center: x = preRect.center().x - nodeRect.center().x; break;
                    case VisualAttribute.Right: x = preRect.width - nodeRect.width; break;
                    case VisualAttribute.Top: y = 0; break;
                    case VisualAttribute.Middle: y = preRect.center().y - nodeRect.center().y; break;
                    case VisualAttribute.Bottom: y = preRect.height - nodeRect.height; break;
                }
            })
            return { x, y };
        }

        let matchedElmentsArray: [HTMLElement | null, Rect][][] = [];

        let firstNode = featureSelector[0];

        elements2Boxs.forEach((box, element) => {
            if (!firstNode.allowNull
                && (!this.visualAttributesMatch(box, firstNode.bounding, firstNode.visualAttributes, firstNode.fuzzy)
                    || !domUtils.isElementMatchSelectorNodeAttribute(element, firstNode.attributes, false)))
                return;
            matchedElmentsArray.push([[element, box]]);
        });

        for (let i = 1; i < featureSelector.length; i++) {
            let selectorNode = featureSelector[i];
            const nextMatchedElmentsArray: [HTMLElement | null, Rect][][] = [];
            matchedElmentsArray.forEach((list) => {
                const currentMatched: [HTMLElement, Rect][] = [];

                // 计算当前节点匹配的矩形
                const preMatchRect = list.at(-1)![1];
                const matchRect = Rect.fromRect(selectorNode.bounding);
                const offset = calculateOffset(preMatchRect, matchRect);
                matchRect.offset(offset.x, offset.y);

                for (let [element, rect] of elements2Boxs) {
                    if (!this.visualAttributesMatch(rect, matchRect, selectorNode.visualAttributes, selectorNode.fuzzy))
                        continue
                    if (!domUtils.isElementMatchSelectorNodeAttribute(element, selectorNode.attributes, false))
                        continue;
                    if (selectorNode.type === FeatureSelectorNodeType.Similar) {
                        let similarElements = this.querySimilarElements(elements2Boxs, element, selectorNode.similarAlignment!);
                        if (similarElements.length === 0)
                            continue;

                    }
                    currentMatched.push([element, rect]);
                }

                if (currentMatched.length === 0 && selectorNode.allowNull)
                    nextMatchedElmentsArray.push([...list, [null, matchRect]]);

                let filtered = currentMatched;
                if (mergeTrunck)
                    filtered = currentMatched.filter(([element, rect]) => currentMatched.findIndex(([e, r]) => this.isDirectPath(element, e)) === -1);

                filtered.forEach(([element, rect]) => {
                    nextMatchedElmentsArray.push([...list, [element, rect]]);
                })

            });
            matchedElmentsArray = nextMatchedElmentsArray;
            if (matchedElmentsArray.length === 0) {
                console.log("no matched elements", selectorNode);
                console.log(elements2Boxs);
                debugger;
            }
        }

        const result: (HTMLElement | null | HTMLElement[])[][] = [];
        matchedElmentsArray.forEach(paths => {
            let resultElements: (HTMLElement | null | HTMLElement[])[] = [];
            for (let i = 0; i < featureSelector.length; i++) {
                let node = featureSelector[i];
                let element = paths[i][0];
                if (!element)
                    resultElements.push(null);
                else if (node.type === FeatureSelectorNodeType.Similar)
                    resultElements.push(this.querySimilarElements(elements2Boxs, element, node.similarAlignment!));
                else
                    resultElements.push(element);
            }
            result.push(resultElements);
        });

        return result;
    }


    this.querySimilarElements = (element2Box: Map<HTMLElement, Rect>, originElement: HTMLElement, alignments: string[]) => {
        let matchedElements = [originElement];
        for (let alignment of alignments) {
            let nextMatchedElements: HTMLElement[] = [];
            let matchFunction: Function;
            switch (alignment) {
                case VisualAttribute.Left:
                    matchFunction = (a: Rect, b: Rect) => a.x === b.x;
                    break;
                case VisualAttribute.Center:
                    matchFunction = (a: Rect, b: Rect) => Math.floor(a.x + a.width / 2) === Math.floor(b.x + b.width / 2);
                    break;
                case VisualAttribute.Right:
                    matchFunction = (a: Rect, b: Rect) => a.x + a.width === b.x + b.width;
                    break;
                case VisualAttribute.Top:
                    matchFunction = (a: Rect, b: Rect) => a.y === b.y;
                    break;
                case VisualAttribute.Middle:
                    matchFunction = (a: Rect, b: Rect) => Math.floor(a.y + a.height / 2) === Math.floor(b.y + b.height / 2);
                    break;
                case VisualAttribute.Bottom:
                    matchFunction = (a: Rect, b: Rect) => a.y + a.height === b.y + b.height;
                    break;
            }

            matchedElements.forEach(matchedElement => {
                let rect = matchedElement.getBoundingClientRect();
                let similarElements = [...element2Box.keys()].filter(element => originElement.tagName === element.tagName && matchFunction(rect, element.getBoundingClientRect()));
                if (similarElements.length < 2)
                    return [];
                nextMatchedElements.push(...similarElements);
            });
            matchedElements = nextMatchedElements;
        }
        return matchedElements;

    }

    interface SingleElement { name: string, element: HTMLElement }
    interface SimilarElement { name: string, elements: HTMLElement[] }

    this.buildFeatureDateSelector = (root: HTMLElement, panels: DatePickerElements[]) => {
        let rootRect = root.getBoundingClientRect();
        let base: Point = { x: rootRect.left, y: rootRect.top };

        let infos: (BuildFeatureSelectorNodeNormalArgs | BuildFeatureSelectorNodeSimilarArgs)[] = [];

        let prefix: string[] = panels.length > 1 ? ["left", "right"] : [""];
        panels.forEach((elements, i) => {
            let headerMap = this.buildHeaderMap(elements, prefix[i]);
            let dateCells = elements.dateCells;
            let commonParent = this.findCommonParent([...headerMap.values()]);


            let name = !commonParent.contains(dateCells[0]) ? "header" : "base";
            let visualAttributes: string[] | undefined = !commonParent.contains(dateCells[0]) ? undefined : [VisualAttribute.Left, VisualAttribute.Right, VisualAttribute.Top];
            infos.push({ name: name, type: FeatureSelectorNodeType.Single, element: commonParent, isAnchor: true, visualAttributes: visualAttributes });

            headerMap.forEach((node, name) => {
                let visualAttributes: string[] | undefined = undefined;
                if (name.toLowerCase().includes("yearmonth")) {
                    visualAttributes = [VisualAttribute.Center, VisualAttribute.Top, VisualAttribute.Bottom];
                    // let isLeaf = node.childElementCount === 0;
                    // if (isLeaf) {
                    //     let textAlignment = window.getComputedStyle(node).textAlign;
                    //     switch (textAlignment) {
                    //         case "center":
                    //             visualAttributes.push(VisualAttribute.Center);
                    //             break;
                    //         case "start":
                    //             visualAttributes.push(VisualAttribute.Left);
                    //             break;
                    //         case "end":
                    //             visualAttributes.push(VisualAttribute.Right);
                    //             break;
                    //     }
                    // }
                    // else {
                    //     visualAttributes = [VisualAttribute.Center, VisualAttribute.Top, VisualAttribute.Bottom];
                    // }
                } else {
                    visualAttributes = undefined;
                }
                infos.push({ name: name, type: FeatureSelectorNodeType.Single, element: node, isAnchor: false, visualAttributes: visualAttributes });
            });
            infos.push({ name: this.toCamelCase(prefix[i] + "DateTable"), type: FeatureSelectorNodeType.Single, element: this.findCommonParent(dateCells), isAnchor: false, visualAttributes: [VisualAttribute.Left, VisualAttribute.Right, VisualAttribute.Top] });
            // infos.push({ name: this.toCamelCase(prefix[i] + "DateCells"), type: FeatureSelectorNodeType.Similar, elements: dateCells.map(node => node.node), isAnchor: false, visualAttributes: ["width", "height"] });
        });

        // 将节点名称转换为驼峰命名
        infos.forEach(info => {
            info.name = this.toCamelCase(info.name);
        })

        let selectors = infos.map(info => this.buildFeatureSelectorNode(base, info));
        this.AddFeatureDateSelectorAttributes(infos, selectors, root);

        console.log(selectors);
        return selectors;
    }

    this.AddFeatureDateSelectorAttributes = (infos: (BuildFeatureSelectorNodeNormalArgs | BuildFeatureSelectorNodeSimilarArgs)[], selectors: FeatureSelectorNode[], root: HTMLElement) => {
        let targets = infos.map(m => {
            let forbiddenAttributes = [];
            if (m.name.toLowerCase().includes("yearmonth"))
                forbiddenAttributes.push("innerText");
            switch (m.type) {
                case FeatureSelectorNodeType.Single:
                    return new WebNode(m.element, forbiddenAttributes)
                case FeatureSelectorNodeType.Similar:
                    return new WebNode(m.elements[0], forbiddenAttributes)
                default:
                    throw Error(`Unknow FeatureSelectorNodeType`);
            }
        })

        let elements2Boxs = this.elment2Map(root);
        let matchedElementsAll = this.queryFeatureSelectorAll(elements2Boxs, selectors, true);

        this.buildFeatureSelectorAttributes(targets, matchedElementsAll, selectors);
    }

    this.buildFeatureSelectorAttributes = (targetNodes: WebNode[], matchedElementsAll: (Element | Element[] | null)[][], selectors: FeatureSelectorNode[]) => {
        let currentMatchedElementsAll = matchedElementsAll;
        for (let i = 0; i < targetNodes.length; i++) {
            let targetNode = targetNodes[i];
            let nextMatchedElementsAll: (Element | Element[] | null)[][] = [];

            currentMatchedElementsAll.forEach((matchedElements, index) => {
                if (targetNode.element === matchedElements[i]) {
                    nextMatchedElementsAll.push(matchedElements);
                    return;
                }
                let matchedElement = matchedElements[i];
                if (matchedElement == null)
                    return;
                if (matchedElement instanceof Array)
                    matchedElement = matchedElement[0]
                let matchedNode = new WebNode(matchedElement);
                if (!targetNode.diffFeature(matchedNode)) {
                    console.error(targetNode.element, "can not diff this element: ", matchedElement)
                    nextMatchedElementsAll.push(matchedElements);
                }

            });
            selectors[i].attributes = targetNode.toSelectorAttribute(true);
            currentMatchedElementsAll = nextMatchedElementsAll;
        }
    }


    this.buildHeaderMap = (panel: DatePickerElements, prefix: string): Map<string, HTMLElement> => {
        let headerMap = new Map<string, HTMLElement>();
        if (panel.preMonth)
            headerMap.set(prefix + "PreMonth", panel.preMonth);
        headerMap.set(prefix + "YearMonth", panel.yearMonth);
        if (panel.nextMonth)
            headerMap.set(prefix + "NextMonth", panel.nextMonth);
        return headerMap;
    }

    this.toCamelCase = (str: string) => {
        if (str.length === 0) {
            return str;
        }
        return str.charAt(0).toLowerCase() + str.slice(1);
    }


    this.getAlignment = (similarElementRects: DOMRect[]) => {
        function maxCount(nums: number[]) {
            let map = new Map();
            for (let num of nums) {
                map.has(num) ? map.set(num, map.get(num) + 1) : map.set(num, 1);
            }
            let max = 1;
            for (let [key, value] of map) {
                if (value > max) {
                    max = value;
                }
            }
            return max;
        }
        let leftAlignCount = maxCount(similarElementRects.map(element => element.left));
        let rightAlignCount = maxCount(similarElementRects.map(element => element.right));
        let topAlignCount = maxCount(similarElementRects.map(element => element.top));
        let bottomAlignCount = maxCount(similarElementRects.map(element => element.bottom));
        let centerAlignCount = maxCount(similarElementRects.map(element => Math.floor(element.left + element.width / 2)));
        let middleAlignCount = maxCount(similarElementRects.map(element => Math.floor(element.top + element.height / 2)));

        let result = [];
        if (leftAlignCount >= 2)
            result.push(VisualAttribute.Left);
        else if (centerAlignCount >= 2)
            result.push(VisualAttribute.Center);
        else if (rightAlignCount >= 2)
            result.push(VisualAttribute.Right);

        if (topAlignCount >= 2)
            result.push(VisualAttribute.Top);
        else if (middleAlignCount >= 2)
            result.push(VisualAttribute.Middle);
        else if (bottomAlignCount >= 2)
            result.push(VisualAttribute.Bottom);
        return result;
    }

    this.getAlignmentOrigin = (similarElements: HTMLElement[], alignment: string[]) => {
        if (alignment.length === 0) {
            return null;
        }
        // 默认按照左上角对齐
        similarElements.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);

        let compare: Function;
        for (let align of alignment) {
            if (align === VisualAttribute.Left)
                compare = (a: DOMRect, b: DOMRect) => a.left - b.left;
            else if (align === VisualAttribute.Center)
                compare = (a: DOMRect, b: DOMRect) => Math.floor(a.left - a.width / 2) - Math.floor(b.left + b.width / 2);
            else if (align === VisualAttribute.Right)
                compare = (a: DOMRect, b: DOMRect) => a.right - b.right;
            else if (align === VisualAttribute.Top)
                compare = (a: DOMRect, b: DOMRect) => a.top - b.top;
            else if (align === VisualAttribute.Middle)
                compare = (a: DOMRect, b: DOMRect) => Math.floor(a.top - a.height / 2) - Math.floor(b.top + b.height / 2);
            else if (align === VisualAttribute.Bottom)
                compare = (a: DOMRect, b: DOMRect) => a.bottom - b.bottom;

            similarElements.sort((a, b) => compare(a.getBoundingClientRect(), b.getBoundingClientRect()));
        }
        return similarElements[0];
    }

    this.findCommonParent = (elements: HTMLElement[]): HTMLElement => {
        if (elements.length === 0)
            throw new Error("elements is empty");

        let parent = elements[0]
        elements.forEach(element => {
            while (parent && !parent.contains(element)) {
                parent = parent.parentNode as HTMLElement;
            }
        })
        return parent;
    }


    this.buildFeatureSelectorNode = (base: Point, info: BuildFeatureSelectorNodeNormalArgs | BuildFeatureSelectorNodeSimilarArgs) => {
        let bounding: Rect;
        let alignment: string[] = [];
        let attributes: SelectorAttribute[] = [];
        switch (info.type) {
            case FeatureSelectorNodeType.Single: {
                let rect = info.element.getBoundingClientRect();
                bounding = new Rect(Math.round(rect.left - base.x), Math.round(rect.top - base.y), Math.round(rect.width), Math.round(rect.height));
                attributes = new WebNode(info.element).toSelectorAttribute(true);
                break;
            }
            case FeatureSelectorNodeType.Similar: {
                let similarElements = info.elements;
                alignment = this.getAlignment(similarElements.map(element => element.getBoundingClientRect()));
                let originElement = this.getAlignmentOrigin(info.elements, alignment!)!;
                attributes = new WebNode(originElement).toSelectorAttribute(true);
                let rect = originElement.getBoundingClientRect();
                bounding = new Rect(Math.round(rect.left - base.x), Math.round(rect.top - base.y), Math.round(rect.width), Math.round(rect.height));
                break;
            }
        }

        let node: FeatureSelectorNode = {
            name: info.name,
            type: info.type,
            attributes: attributes,
            allowNull: false,
            isAnchor: info.isAnchor,
            similarAlignment: alignment,
            visualAttributes: info.visualAttributes || [VisualAttribute.Left, VisualAttribute.Right, VisualAttribute.Top, VisualAttribute.Bottom],
            bounding: bounding,
            fuzzy: 8
        }!;
        return node;
    }


    // this.mapDatePickerElementsToNodes = (elements: DatePickerElements, treeNodeRoot: TreeNode, prefix: string): [Map<string, TreeNode>, TreeNode[]] => {
    //     let headerChildren = [
    //         { name: prefix + "PreMonth", elment: elements.preMonth },
    //         { name: prefix + "YearMonth", elment: elements.yearMonth },
    //         { name: prefix + "NextMonth", elment: elements.nextMonth }
    //     ];
    //     let headerMap = new Map<string, TreeNode>();
    //     for (let button of headerChildren) {
    //         if (!button.elment)
    //             continue;
    //         let node = this.mapElementToNode(treeNodeRoot, button.elment)!;
    //         headerMap.set(this.toCamelCase(button.name), node);
    //     }

    //     let dateCells = elements.dateCells.map((element) => this.mapElementToNode(treeNodeRoot, element)!);
    //     return [headerMap, dateCells];
    // }

    // this.mapElementToNode = (node: TreeNode, element: HTMLElement): TreeNode | null => {
    //     for (let child of node.children.reverse()) {
    //         let result = this.mapElementToNode(child, element);
    //         if (result) {
    //             return result;
    //         }
    //     }
    //     if (element === node.node || node.node.contains(element)) {
    //         return node;
    //     }
    //     return null;
    // }


    // this.findCommonNodeParent = (elements: TreeNode[]) => {
    //     let parent = elements.find(element => element !== null)!.parent;
    //     elements.forEach(element => {
    //         if (!element)
    //             return;
    //         while (parent && !parent.contains(element)) {
    //             parent = parent.parent!;
    //         }
    //     })
    //     return parent!;
    // }

    // this.buildVisualTree = (element: HTMLElement): TreeNode => {

    //     function hasArea(node: TreeNode) {
    //         let rect = node.node.getBoundingClientRect();
    //         return rect.width * rect.height !== 0;
    //     }

    //     function createRoot() {
    //         let div = document.createElement('div');
    //         document.body.appendChild(div);
    //         div.getBoundingClientRect = () => ({
    //             "x": Number.NEGATIVE_INFINITY,
    //             "y": Number.NEGATIVE_INFINITY,
    //             "width": Number.POSITIVE_INFINITY,
    //             "height": Number.POSITIVE_INFINITY,
    //             "top": Number.NEGATIVE_INFINITY,
    //             "right": Number.POSITIVE_INFINITY,
    //             "bottom": Number.POSITIVE_INFINITY,
    //             "left": Number.NEGATIVE_INFINITY,
    //             toJSON: () => toString(),
    //         });
    //         return new TreeNode(div);
    //     }

    //     function buildTree(root: HTMLElement) {
    //         const treeNode = new TreeNode(root);
    //         Array.from(root.children).forEach(child => {
    //             treeNode.addChild(buildTree(child as HTMLElement));
    //         })
    //         return treeNode;
    //     }

    //     function diffTree(treeNodeRoot: TreeNode) {
    //         treeNodeRoot.children.forEach(treeNodeChild => diffTree(treeNodeChild));
    //         treeNodeRoot.children = treeNodeRoot.children.filter(hasArea);
    //         if (treeNodeRoot.children.length === 1) {
    //             if (hasArea(treeNodeRoot)) {
    //                 treeNodeRoot.children = treeNodeRoot.children[0].children;
    //                 for (let child of treeNodeRoot.children) {
    //                     child.parent = treeNodeRoot;
    //                 }
    //             } else {
    //                 let index = treeNodeRoot.parent!.children.indexOf(treeNodeRoot)
    //                 treeNodeRoot.parent!.children[index] = treeNodeRoot.children[0];
    //             }
    //         }
    //     }

    //     function adjustTree(root: TreeNode) {
    //         const adjustments: TreeNode[] = [];

    //         // 深度优先遍历树，记录需要调整的节点
    //         function traverse(node: TreeNode) {
    //             if (!node) {
    //                 return;
    //             }

    //             const parentBounding = node.node.getBoundingClientRect();

    //             for (const child of node.children) {
    //                 const childBounding = child.node.getBoundingClientRect();

    //                 if (!rectContains(parentBounding, childBounding)) {
    //                     adjustments.push(child);
    //                 }

    //                 // 继续处理子节点的子节点
    //                 traverse(child);
    //             }
    //         }


    //         function rectContains(rect: DOMRect, rect2: DOMRect) {
    //             // 经验值20，处理简单的子元素稍微超出父元素的情况
    //             return rect.left - 20 <= rect2.left && rect.right + 20 >= rect2.right && rect.top - 20 <= rect2.top && rect.bottom + 20 >= rect2.bottom;
    //         }

    //         // 调整收集到的节点层级
    //         function applyAdjustments() {
    //             for (const child of adjustments) {
    //                 findNewParent(child);
    //             }
    //         }

    //         function findNewParent(childNode: TreeNode) {
    //             let currentNode: TreeNode | null = childNode.parent!;
    //             let childBounding = childNode.node.getBoundingClientRect();
    //             if (rectContains(currentNode.node.getBoundingClientRect(), childBounding))
    //                 return;

    //             childNode.children = childNode.children.filter(child => child.node !== childNode.node);

    //             // 找到新的父节点
    //             while (!rectContains(currentNode!.node.getBoundingClientRect(), childBounding)) {
    //                 currentNode = currentNode!.parent;
    //                 if (!currentNode) {
    //                     console.error(`找不到合适的父节点, ${currentNode} `);
    //                     return;
    //                 }
    //             }
    //             const newParent = currentNode;

    //             // 把 childNode 添加为 newParent的子节点
    //             newParent.addChild(childNode);
    //         }

    //         // 开始调整树
    //         traverse(root);
    //         applyAdjustments();
    //     }

    //     let elementRoot = buildTree(element)
    //     diffTree(elementRoot);
    //     let root = createRoot();
    //     root.addChild(elementRoot);
    //     const treeNodeRoot = elementRoot;
    //     adjustTree(treeNodeRoot);

    //     return treeNodeRoot;
    // }

}

function findByXpath(xpath: string) {
    return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement | null;
}

function findAllByXpath(xpath: string) {
    const iterator = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_ITERATOR_TYPE,
        null
    );

    const nodes = [];
    let node = iterator.iterateNext();
    while (node) {
        nodes.push(node);
        node = iterator.iterateNext();
    }

    return nodes;
}

interface Point {
    x: number,
    y: number
}
interface PanelPoint {
    preMonth: Point,
    yearMonth: Point,
    nextMonth: Point,
    dates: Point[]
}
const DATE_TAG_NAME = {
    YEAR_MONTH: 'yearMonth',
    PRE_MONTH: 'preMonth',
    NEXT_MONTH: 'nextMonth',
    DATES: 'dates'
}

interface window {
    uiaDispatcher: any;
    uiaError: any;
}

class Bubbling {
    args: any
    constructor(args: any) {
        this.args = args
    }
}

class Tunneling {
    frameIndex: number
    args: any
    constructor(frame: any, args: any) {
        this.args = args
        this.frameIndex = domUtils.getFrameIndex(frame.contentWindow)
    }
}

class ActionError extends Error {
    constructor(message: string) {
        super(message || "")
    }
}

class UIAError extends Error {
    code: number
    constructor(code: number, message: string) {
        super(message || "")
        this.code = code
    }
}

const UIAERROR_CODE = {
    ValidationFail: -2, // 参数验证失败
    Unknown: -1, // 未知异常
    Common: 1, // 通用异常
    UIDriverConnectionError: 9, // UIDriver连接错误
    CEFBrowserConnectionError: 10, // CEF浏览器连接错误
    NonsupportOperation: 13, // 元素不支持此操作
    NoSuchWindow: 100, // 未找到窗口
    NoSuchElement: 101, // 未找到元素
    NoSuchFrame: 102, // 未找到Frame
    PageIsLoading: 103, // 网页尚未加载完成
    FrameIsLoading: 104, // 网页中的Frame尚未加载完成
    JavaScriptError: 105, // JavaScript执行出错
    NoSuchElementID: 106, // 未找到元素指定的元素ID（缓存失效）
    NoSuchImage: 107, // 未找到图像
    Timeout: 108, // 操作超时
    AIError: 109, // AI识别错误
    DriverInputError: 110, // 无法通过驱动模拟按键输入
    CDPMethodNotFound: 111, // 未找到CDP的方法
    NoSuchOCREngine: 112, // 未找到OCR引擎
    CreateTableSelectorError: 113, // 创建TableSelector失败
    CalcSimilarPathError: 114, // 指定元素无法计算出相似路径
    MultiElementID: 115, // 指定ID匹配到多个元素

    DateSelector_Build_Failed_ExtractYearMonth: 5010004,    // 解析年月失败
    DateSelector_Build_Failed_Details_From_Points: 5010005, // 坐标转元素失败
    DateSelector_Build_Failed_PanelBase_From_Points: 5010006,   // 获取PanelBase失败
    DateSelector_Build_Failed_Dates_From_Points: 5010007,   // 构建日相似元素失败
    DateSelector_Build_Failed_DateSelector_From_Points: 5010008,    // 构建选择器失败
    DateSelector_Build_Failed_Verify_Btn_Error: 5010009,    // 验按钮功能不达预期
}

interface UiaI18n {
    data: { [key: string]: string };
    init: () => void;
    get: (key: string) => string;
}

window.uiaI18n = (function () {
    const uiaI18n: UiaI18n = {
        data: {},
        init: function () {
            this.data = {
                'StatusSelector_Build_Failed_Not_Onchange': "点击状态元素后没有属性变化"
            };
        },
        get: function (key: string): string {
            return this.data[key];
        }
    };
    return uiaI18n;
})();
window.uiaI18n.init();

class Actions {
    static featureDateSelectorFromPoints = (args: { tabId: number, panels: PanelPoint[], sPath: SelectorNode[] }) => {
        let panels = args.panels

        panels.sort((a, b) => a.yearMonth.x - b.yearMonth.x);
        let yearMonthPoint = panels[0].yearMonth
        let element = domUtils.elementFromPoint(yearMonthPoint.x, yearMonthPoint.y)
        if (!element)
            throw new UIAError(UIAERROR_CODE.DateSelector_Build_Failed_Details_From_Points, window.uiaI18n.get("DateSelector_Build_Failed_Details_From_Points").format(DATE_TAG_NAME.YEAR_MONTH));

        // 跨域处理
        if (domUtils.matchElementType(element, TAGS.IFRAME, TAGS.FRAME)) {
            const sPath = domUtils.buildSelector(element)
            const bounding = Rect.fromDOMRect(element.getBoundingClientRect())
            const offset = domUtils.getFrameOffset(element)
            panels.forEach(panelPoint => {
                Object.keys(panelPoint).forEach(key => {
                    let item = panelPoint[key]
                    if (!item) return;
                    if (key === DATE_TAG_NAME.DATES) {
                        item.forEach((day: Rect) => {
                            day.x = day.x - bounding.x - offset.x;
                            day.y = day.y - bounding.y - offset.y;
                        })
                    } else {
                        item.x = item.x - bounding.x - offset.x;
                        item.y = item.y - bounding.y - offset.y;
                    }
                })
            })

            return new Tunneling(element, {
                panels: panels,
                sPath: args.sPath ? args.sPath.concat(sPath) : sPath
            })
        }
        let panelsBaseElement: HTMLElement = element;
        let dateElements = panels.map(panelPoint => {
            let yearMonthElement = domUtils.elementFromPoint(panelPoint.yearMonth.x, panelPoint.yearMonth.y)
            if (!yearMonthElement)
                throw new UIAError(UIAERROR_CODE.DateSelector_Build_Failed_Details_From_Points, window.uiaI18n.get("DateSelector_Build_Failed_Details_From_Points").format(DATE_TAG_NAME.YEAR_MONTH));

            let yearMonthBaseElement = dateUtils.findYearMonthBase(yearMonthElement)
            if (!yearMonthBaseElement)
                throw new UIAError(UIAERROR_CODE.DateSelector_Build_Failed_ExtractYearMonth, window.uiaI18n.get("DateSelector_Build_Failed_ExtractYearMonth"));

            let preMonth = panelPoint.preMonth ? domUtils.elementFromPoint(panelPoint.preMonth.x, panelPoint.preMonth.y) : null;
            let nextMonth = panelPoint.nextMonth ? domUtils.elementFromPoint(panelPoint.nextMonth.x, panelPoint.nextMonth.y) : null;
            let dates = panelPoint.dates.map(day => domUtils.elementFromPoint(day.x, day.y)).filter(element => dateUtils.isDayElement(element));
            let elements = [yearMonthBaseElement, preMonth, nextMonth].concat(dates);
            panelsBaseElement = dateUtils.findCommonParent([panelsBaseElement, ...elements]);
            let dateSelectorElement: DatePickerElements = { preMonth: preMonth, yearMonth: yearMonthBaseElement, nextMonth: nextMonth, dateCells: dates };
            return dateSelectorElement;
        });

        let featureSelectors = dateUtils.buildFeatureDateSelector(panelsBaseElement, dateElements);
        console.log(featureSelectors);

        let panelsBaseSPath = domUtils.buildSelector(panelsBaseElement!);
        panelsBaseSPath = args.sPath ? args.sPath.concat(panelsBaseSPath) : panelsBaseSPath;
        let panelsBaseUid = domUtils.uidFromElement(panelsBaseElement!);

        return {
            //frameId: window.uiaDispatcher.frameBackendId,
            panelsBaseUid: panelsBaseUid,
            panelsBase: panelsBaseSPath,
            nodes: featureSelectors
        }
    }

    static queryFeatureDateSelectorAll = (args: { panelsBase: SelectorNode[], elementId: string, nodes: FeatureSelectorNode[] }) => {
        //1、预处理
        const sPath = args.panelsBase
        let elements = null;
        //2、获取DOM对象列表
        if (args.elementId) {
            elements = [domUtils.elementFromUid(args.elementId)];
        } else {
            elements = domUtils.querySPath(sPath, null);
        }

        //3、同时处理用户录制的路径出现的（一般情况和跨域情况），跨域情况一般是指用户路径中包含iframe和frame元素
        //3.1 用户路径跨域的情况下，elements只会包含一个iframe元素对象，elements[0]
        if (elements.length === 1 &&
            domUtils.matchElementType(elements[0], TAGS.IFRAME, TAGS.FRAME) &&
            sPath.length > 0) {
            return new Tunneling(elements[0], { //返回iframe对象及其路径，用于之后找到iframe在整个标签页browser中的索引位置
                path: sPath //以shift模式调用querySPath时会修改sPath，此时sPath为在后一个域中的路径，如div>div>iframe>div>a，此时返回的sPath为div>a
            })
        }
        //3.2 非跨域的情况下，直接返回普通元素对象的id即可
        else {
            if (elements.length === 0)
                console.log("queryFeatureDateSelectorAll panelBaseElement not found")
            else if (elements.length > 1)
                console.log("queryFeatureDateSelectorAll panelBaseElement found more than one")

            let base = elements[0]
            let featureSelectors = args.nodes;
            let matchedPanels = dateUtils.queryFeatureDateSelectorAll(base, featureSelectors);
            console.log(matchedPanels);
            const result = JSON.parse(JSON.stringify(matchedPanels));
            for (let panels of result) {
                for (let datePickerElement of panels) {
                    datePickerElement.preMonth = datePickerElement.preMonth ? domUtils.uidFromElement(datePickerElement.preMonth) : null;
                    datePickerElement.yearMonth = domUtils.uidFromElement(datePickerElement.yearMonth);
                    datePickerElement.nextMonth = datePickerElement.nextMonth ? domUtils.uidFromElement(datePickerElement.nextMonth) : null;
                    datePickerElement.dateCells = datePickerElement.dateCells.map((cell: HTMLElement) => domUtils.uidFromElement(cell));
                }
            }
            if (result.length !== 1)
                throw new UIAError(UIAERROR_CODE.DateSelector_Build_Failed_Details_From_Points, "找到多个日期选择器");
            return result[0]
        }
    }
}

function resolveElement() {
    let base = findByXpath("(//div[@class='ant-picker-date-panel'])[1]") as HTMLElement;
    let preMonth = findByXpath("(//div[@class='ant-picker-panel-layout']//div//button[@aria-label='prev-year'])[1]") as HTMLElement;
    let nextMonth = findByXpath("(//div[@class='ant-picker-panel-layout']//div//button[@aria-label='next-year'])[1]") as HTMLElement;
    let yearMonth = findByXpath("(//div[@class='ant-picker-panel-layout']//div//div[@class='ant-picker-header-view'])[1]") as HTMLElement;
    let cells = findAllByXpath("(//div[@class='ant-picker-body'])[1]/table[1]/tbody[1]/tr/td") as HTMLElement[];
    let elements: DatePickerElements = { preMonth: preMonth, yearMonth: yearMonth, nextMonth: nextMonth, dateCells: cells }
    // @ts-ignore: Suppress error TS2339.
    let featureSelectors = dateUtils.buildFeatureDateSelector(base, [elements]);
    console.log(featureSelectors);
    let node = featureSelectors.find(node => node.name === "nextMonth")!.bounding.x += 1;

    return featureSelectors;
}

function querySelectorAll(featureSelector: FeatureSelectorNode[]) {
    let base = findByXpath("(//div[@class='ant-picker-date-panel'])[1]") as HTMLElement;
    // @ts-ignore: Suppress error TS2339.
    let result = dateUtils.queryFeatureDateSelectorAll(base, featureSelector);
    return result;
}

function main() {
    let featureSelector = resolveElement();
    let reuslt = querySelectorAll(featureSelector);
    console.log(reuslt);
}
main();

