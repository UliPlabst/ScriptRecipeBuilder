import { Component, computed, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatHint } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatToolbar } from '@angular/material/toolbar';

interface RecipeVariable {
  name: string;
  comment: string | null;
}

@Component({
  selector: 'app-root',
  imports: [
    MatButton,
    MatFormField,
    MatHint,
    MatIcon,
    MatInput,
    MatToolbar
  ],
  templateUrl: './app.html',
  styleUrl: './app.sass'
})
export class App {
  protected readonly recipeText = signal('');
  protected readonly variableValues = signal<Record<string, string>>({});
  protected readonly copyButtonLabel = signal('Copy');

  protected readonly variables = computed<RecipeVariable[]>(() => {
    const recipe = this.recipeText();
    const comments = this.extractHeaderComments(recipe);
    const names = new Set<string>();
    const variables: RecipeVariable[] = [];
    const variablePattern = /\$\{([^}]+)\}\$/g;

    for (const match of recipe.matchAll(variablePattern)) {
      const name = match[1].trim();

      if (!name || names.has(name)) {
        continue;
      }

      names.add(name);
      variables.push({
        name,
        comment: comments.get(name) ?? null
      });
    }

    return variables;
  });

  protected readonly renderedRecipe = computed(() => {
    const values = this.variableValues();

    return this.recipeText().replace(/\$\{([^}]+)\}\$/g, (_match, variableName: string) => {
      return values[variableName.trim()] ?? '';
    });
  });

  protected updateRecipe(event: Event): void {
    this.recipeText.set(this.readControlValue(event));
    this.copyButtonLabel.set('Copy');
  }

  protected updateVariableValue(name: string, event: Event): void {
    const value = this.readControlValue(event);

    this.variableValues.update((values) => ({
      ...values,
      [name]: value
    }));
    this.copyButtonLabel.set('Copy');
  }

  protected async copyRenderedRecipe(): Promise<void> {
    await navigator.clipboard.writeText(this.renderedRecipe());
    this.copyButtonLabel.set('Copied');
  }

  private extractHeaderComments(recipe: string): Map<string, string> {
    const comments = new Map<string, string>();

    for (const line of recipe.split(/\r?\n/)) {
      const trimmedLine = line.trim();

      if (!trimmedLine.startsWith('//') && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('-')) {
        continue;
      }

      const headerContent = trimmedLine.replace(/^(?:\/\/|#|-)\s*/, '');
      const headerMatch = headerContent.match(/^([^:]+):\s*(.+)$/);

      if (!headerMatch) {
        continue;
      }

      comments.set(headerMatch[1].trim(), headerMatch[2].trim());
    }

    return comments;
  }

  private readControlValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
