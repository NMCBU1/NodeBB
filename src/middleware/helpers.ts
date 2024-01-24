import { Request, Response, NextFunction } from 'express';
import * as winston from 'winston';
import validator from 'validator';
import slugify from '../slugify';
import * as meta from '../meta';

declare function slugify(input: string): string;


interface TemplateData {
    template?: {
      topic?: string; // Replace 'any' with a more specific type if you know the structure
    };
    category?: {
        cid: string;
        name: string;
      }
    breadcrumbs?: Array<{ cid: string }>;
}

interface CustomRequest extends Request {
    loggedIn: boolean; // Add your custom properties here
}

interface Config {
    [key: string]: string; // or a more specific type if possible
}

interface Meta {
    config: Config;
}

let meta: Meta;

const helpers = {
    try: (middleware: (req: Request, res: Response, next: NextFunction) => Promise<void> | void) => async (
        req: Request, res: Response, next: NextFunction
    ) => {
        try {
            await middleware(req, res, next);
        } catch (err) {
            next(err);
        }
    },
    buildBodyClass: (req: CustomRequest, res: Response, templateData: TemplateData = {}) => {
        const clean = req.path.replace(/^\/api/, '').replace(/^\/|\/$/g, '');
        const parts = clean.split('/').slice(0, 3);
        parts.forEach((part : string, index) => {
            let p : string = part;
            try {
                p = slugify(decodeURIComponent(p));
            } catch (err: unknown) {
                if (err instanceof Error) {
                    winston.error(`Error decoding URI: ${p}`);
                    winston.error(err.stack);
                }
            }
            p = validator.escape(String(p));
            parts[index] = index ? `${parts[0]}-${p}` : `page-${p || 'home'}`;
        });
        if (templateData.template && templateData.template.topic) {
            parts.push(`page-topic-category-${templateData.category.cid}`);
            parts.push(`page-topic-category-${slugify(templateData.category.name)}`);
        }
        if (Array.isArray(templateData.breadcrumbs)) {
            templateData.breadcrumbs.forEach((crumb) => {
                if (crumb && crumb.hasOwnProperty('cid')) {
                    parts.push(`parent-category-${crumb.cid}`);
                }
            });
        }
        parts.push(`page-status-${res.statusCode}`);
        if (typeof meta.config['theme:id'] === 'string') {
            parts.push(`theme-${meta.config['theme:id'].split('-')[2]}`);
        } else {
            // Handle the case where 'theme:id' is not a string
        }
        if (req.loggedIn) {
            parts.push('user-loggedin');
        } else {
            parts.push('user-guest');
        }
        return parts.join(' ');
    },
};
export default helpers;
